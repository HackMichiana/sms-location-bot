
# sms-location-bot

`I’m a bot! You send me a location via SMS, and I reply with the nearest location I know of for the thing I know how to locate.`

## Running `sms-location-bot`

`sms-location-bot` is an Express app that can be run via e.g. `node index.js`, but see configuration documentation below.
It has a `POST` endpoint at `/sms` and is designed to be used as a Twilio [webhook](https://www.twilio.com/docs/sms/quickstart/node).
It _also_ expects to be run in some kind of host that handles SSL termination on its behalf and so uses HTTP.

## Configuring `sms-location-bot`

### Environment variables

Here is a list of the configuration parameters `sms-location-bot` expects to find in its process environment:

- `PORT`: the HTTP port for the Express server to listen on
- `DATA_URL`: the location of the `geo.json`-style location file

## Data format

`sms-location-bot` expects to find at `DATA_URL` a JSON file describing the resources it is helping callers to locate.
