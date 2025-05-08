# 3dash-server

A lightweight open-source server for [3Dash](https://delugedrop.itch.io/3dash).
You can use it in-game by using the server switcher hack in [3DashUtils](https://github.com/art0007i/3dashutils).

# Features

 - Uploading levels in-game
 - Disabling uploads
 - Recent levels in random order
 - Recent levels
 - Customizable amount of recent levels
 - Downloading levels
 - 100% API compatibility with original server
 - IP Logging for attack mitigation

# Setup

```
git clone https://github.com/slashedCodes/3dash-server.git
cd 3dash-server

mkdir levels # populate with .json files
nano config.toml # Change the config file to your preference

bun run index.js
# OR, use pm2
pm2 start pm2.config.js --name 3dash-server --output latest.log
```