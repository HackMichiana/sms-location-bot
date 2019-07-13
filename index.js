const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const zipcodes = require('zipcodes');
const util = require('util');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const app = express();

let locationData = new Map(); // actually fetched at server startup

const fetchLocationData = () => {
    console.log(`[${new Date()}] Updating location data...`);
    https.get(process.env.DATA_URL, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
      
        let error;
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' +
                            `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
          error = new Error('Invalid content-type.\n' +
                            `Expected application/json but received ${contentType}`);
        }
        if (error) {
          console.error(error.message);
          // Consume response data to free up memory
          res.resume();
          return;
        }
      
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            tmpData = JSON.parse(rawData); // FIXME: probably should sanitize this with something smarter than JSON.parse
            locationData = extractGeoJsonData(tmpData);
          } catch (e) {
            console.error(e.message);
          }
        });
        console.log(`[${new Date()}] Location update complete.`);
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}

const processMessage = (message) => {
    const sentZipCodes = extractMessageZipCodes(message);
    if(sentZipCodes.length == 0) {
        return `Sorry, I couldn't find any ZIP codes in your text message. Please try again.`;
    }
    
    const knownZipCodes = Array.from(locationData.keys());
    let foundShelters = [];
    knownZipCodes.map((known) => {
        sentZipCodes.map((sent) => {
            if(sent.startsWith(known.substring(0,2))) {
                foundShelters.push(known);
            }
        });
    });
   
    if (foundShelters.length == 0) {
        return `Sorry, I don't know about any shelters near ${sentZipCodes[0]}. Please try again later!`;
    }
    let sheltersArray = [];
    let totalResults = 0;
    for (let zip of foundShelters) {
        const shelters = Array.from(locationData.get(zip));
        totalResults += shelters.length;
        sheltersArray = sheltersArray.concat(
            shelters.map((sh) => {
                const { shelter, address, phone } = sh;
                return String.raw`
                Name: ${shelter}
                Address: ${address}
                Phone: ${phone || 'not known'}
                `;
            })
        );
    }
    let messages = [];
    let resultString = `Found ${totalResults} shelters near you: `;
    for (let shelter of sheltersArray) {
        if ((resultString + shelter).length > 800) {
            messages.push(resultString);
            resultString = '';
        }
        resultString += shelter;
    }
    if (resultString.length > 0) { messages.push(resultString) };
    if (messages.length > 1) {
        messages = messages.map((message, idx, ary) => `[${idx + 1} of ${ary.length}] ${message}`);
    }
    return messages;
}

const extractMessageZipCodes = (message) => {
    const zipCodeRegex = RegExp('[0-9]{5}', 'g');
    let matches = [];
    while ((match = zipCodeRegex.exec(message)) != null) {
        matches.push(match[0]);
    }
    // ensure valid US/Canada zip codes found
    return matches.filter((z) => zipcodes.lookup(z).hasOwnProperty('zip'));
}

const extractGeoJsonData = (json) => {
    let extractedData = new Map();
    let featureCount = 0;
    json.features.map((val, _idx, _ary) => {
        const { zip } = val.properties;
        featureCount += 1;
        if(!extractedData.has(zip)) {
            extractedData.set(zip, new Array());           
        }
        extractedData.get(zip).push(val.properties);
    });
    console.log(`Extracted ${featureCount} features in ${extractedData.size} distinct zip codes.`);
    return extractedData;
}

app.use(bodyParser.urlencoded({extended: false}));
app.post('/sms', (req, res) => {
    const twiml = new MessagingResponse();
    const replies = processMessage(req.body.Body);
    for (let reply of replies) {
        twiml.message(reply);
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  });
  
http.createServer(app).listen(process.env.PORT, () => {
    fetchLocationData();
    const minutesInMS = 60000;
    const refreshTimer = setInterval(fetchLocationData, 5 * minutesInMS);
    process.on('exit', () => clearInterval(refreshTimer));
    console.log(`Express server listening on: ${process.env.PORT}`);
  });