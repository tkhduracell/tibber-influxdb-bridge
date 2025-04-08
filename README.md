# Tibber InfluxDB Fetcher

A Node.js application that fetches real-time data from the Tibber API and stores it in InfluxDB. This application is containerized using Docker for easy deployment.

## Features

- Real-time energy consumption data from Tibber
- Automatic data storage in InfluxDB time-series database
- Dockerized for easy deployment
- Configurable via environment variables
- Automatic reconnection handling

## Requirements

- Docker and Docker Compose
- Tibber API access token
- Tibber Home ID

## Configuration

Configure the application using environment variables in the `docker-compose.yml` file:

### Tibber Configuration

- `TIBBER_ACCESS_TOKEN`: Your Tibber API access token (required)
- `TIBBER_HOME_ID`: Your Tibber Home ID (required)
- `TIBBER_QUERY_URL`: Tibber API GraphQL endpoint (default: https://api.tibber.com/v1-beta/gql)
- `TIBBER_FEED_TIMEOUT`: Feed timeout in seconds (default: 60)
- `TIBBER_CONNECTION_TIMEOUT`: Connection timeout in seconds (default: 30)

### InfluxDB Configuration

- `INFLUXDB_URL`: InfluxDB server URL (default: http://influxdb:8086)
- `INFLUXDB_TOKEN`: InfluxDB authentication token (required)
- `INFLUXDB_ORG`: InfluxDB organization (default: my-org)
- `INFLUXDB_BUCKET`: InfluxDB bucket to store data (default: tibber)
- `INFLUXDB_MEASUREMENT`: InfluxDB mesurement to store data (default: live_data)

\n### Logging Configuration\n\n- `LOG_LEVEL`: Sets the logging level (e.g., 'debug', 'info', 'warn', 'error'). Defaults to 'debug' in development and 'info' in production.\n- `LOG_FORMAT`: Sets the logging format. Use 'json' for structured JSON logs or 'pretty' for human-readable, colorized logs. Defaults to 'pretty' in development and 'json' in production.
## Installation

1. Clone this repository:
   ```bash
   curl https://raw.githubusercontent.com/tkhduracell/tibber-influxdb-bridge/refs/heads/main/docker-compose.yml > docker-compose.yml
   ```

2. Create environment variables in `.env`:
   ```
   TIBBER_ACCESS_TOKEN=your-tibber-token
   TIBBER_HOME_ID=your-home-id
   TIBBER_QUERY_URL=https://api.tibber.com/v1-beta/gql
   
   INFLUXDB_URL=http://influx-url:8086/
   INFLUXDB_TOKEN=your-token
   INFLUXDB_ORG=your-org
   INFLUXDB_BUCKET=your-bucket
   INFLUXDB_MEASUREMENT=your-measurment
   ```

3. Start the containers:
   ```bash
   docker-compose up -d
   ```

## Usage

The application will automatically connect to the Tibber API and begin streaming real-time data to your InfluxDB instance. You can monitor the logs with:

```bash
docker logs -f tibber-influx-bridge
```

### InfluxDB Dashboard

Access the InfluxDB dashboard at http://localhost:8086 to create dashboards and explore your energy consumption data.

## Development

### Running without Docker

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set environment variables:
   ```bash
   export TIBBER_ACCESS_TOKEN=your-tibber-access-token
   export TIBBER_HOME_ID=your-tibber-home-id
   # Set other variables as needed
   ```

3. Start the application:
   ```bash
   pnpm dev
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Originally based on the [node-red-contrib-tibber-api](https://github.com/bisand/node-red-contrib-tibber-api) by André Biseth.