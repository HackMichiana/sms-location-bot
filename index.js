const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const util = require('util');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const app = express();

let locationData = {}; // actually fetched at server startup

const fetchLocationData = () => {
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
            locationData = JSON.parse(rawData); // FIXME: probably should sanitize this with something smarter than JSON.parse
          } catch (e) {
            console.error(e.message);
          }
        });
      }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}

app.use(bodyParser.urlencoded({extended: false}));
app.post('/sms', (req, res) => {
    const twiml = new MessagingResponse();
    
    console.log(`request Body: ${req.body.Body}`);
    const zipCodeRegex = RegExp('\d{5}', 'g');
    console.log(`test ${zipCodeRegex.test('12345')}`);
    let matches = [];
    while ((match = zipCodeRegex.exec(req.body.Body)) != null) {
        matches.push(match);
    }
    console.log(`Matches: ${util.inspect(matches, false, null, true)}`);

    twiml.message(`Found ${util.inspect(matches, false, null, false)} in message`);
  
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  });
  
http.createServer(app).listen(process.env.PORT, () => {
    fetchLocationData();
    console.log(`Express server listening on: ${process.env.PORT}`);
  });