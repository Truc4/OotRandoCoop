# Ocarina of Time Rando Co-Op System
#### Author: denoflions
#### Primary tester: Delphirus.

## Description
This program synchronizes the data of two copies of The Legend of Zelda: Ocarina of Time (v1.0, US) running within the [BizHawk](https://github.com/TASVideos/BizHawk "BizHawk") emulator. It was made with the [Oot Randomizer](https://github.com/AmazingAmpharos/OoT-Randomizer "Oot Randomizer") in mind.

## Features
#### The following things are synchronized
- Item acquisition (Picking up new items and upgrades including magic and defense)
- Songs
- World state (Blowing up bolders, opening chests, picking up PoH, etc.)
- Quest status (Talking to Zelda as child, obtaining Epona, etc.)
- Skulltulas. (Special care has been taken to prevent skulltula duping)
- Heart containers
- Bottle contents (Let the shenanigans ensue.)

#### The following things are **not** synchronized
- Item quantity. (Your bomb count is your own.)
- Rupees.
- Current magic.
- Current HP.

#### Technical Details
This system is in two parts
1. A lua script that runs inside the BizHawk Lua Console
2. A node js program that runs in the background.

The lua script mostly serves to read/write the game memory. The node program gets information from the lua script via local TCP socket (port 1337) and does all the heavy lifting.

When you pause the game the lua script takes stock of what you have in your inventory and if something new is detected it sends that information up to node. Node will run some bit comparisons to ensure nothing is being regressively overwritten and send that information to your partner's node instance via TCP POST (default port 8081, configurable). Any new data that node recieves from your partner is run through the same bit comparisons to ensure nothing is wrong and sends it to the lua script to be written back to the game. During this memory writing it also ensures your C buttons are properly updated in the event an item in a slot changed.

When you pass through a loading zone the lua file gathers all your world and quest data. Any new information is sent to node for processing and the same thing occurs. Keep in mind it only updates **when passing through loading zones** because the new data won't be recognized by the game until a new area loads.

#### Installation and usage
The node side of this project can be run directly should you have it. Otherwise we offer precompiled binaries made using [pkg](https://github.com/zeit/pkg "pkg") that contain everything you need for Windows, Linux, and Mac. Get them on the release page.

Download the package for your operating system and extract it in your BizHawk folder (same level as the executable EmuHawk). Everything is already placed within the zip to end up in the correct place.

Configure your node: Open OotRandoCoop-config.ini in any text editor.

![config](https://i.imgur.com/KAJD186.png "config")

Server Options:
- port: The port your node will listen on for data from your partner. The program will attempt to open this port via UPNP automatically.
- partner_ip: Your partner's IP address. They can obtain their IP address to tell you [here](https://www.whatismyip.com/ "here"). Please note you can add more than one partner here by seperating the ip addresses with commas. This feature is experimental.

Tracker Options:
- enabled: Enable or disable the built in automated item tracker. The tracker can be accessed by going to http://localhost:8081 in a web browser. Please substitute the 8081 for your configured port number if you changed it.

![tracker](https://i.imgur.com/LTvTKhm.png)

Launch your node once you've finished configuring it by double clicking the OotRandoCoop executable file.

In Bizhawk, go to Config -> Customize -> Advanced and make sure Lua+LuaInterface is selected or this script **will not work**.

![Lua Configuration](https://i.imgur.com/izrsT5A.png "Lua Configuration")

Load your rom in BizHawk then load the script in the Lua Console. To access the Lua Console, click Tools -> Lua Console. Make sure you actually activate the script. You should be notified with in-game messages if everything is working.

![Lua Console](https://i.imgur.com/eLC0R0l.png "Lua Console")
![title screen](https://i.imgur.com/9pCU2yv.png "title screen")

Once you and your partners have entered the game and are in Link's house simply pause the game to initiate the syncing system. Please note there will be some lag the first time you exit Link's house. This is perfectly normal as the syncing system does its initial calculations on the world state.

