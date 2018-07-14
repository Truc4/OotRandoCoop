# Ocarina of Time Rando Co-Op System
#### Author: [denoflions](https://www.twitch.tv/scrollforinitiative "denoflions")
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
- **Dungeon keys**
#### FAQ
- Q: **Can I see my co-op partner's Link in the game?**
- A: No.
- Q: **How often does it sync?**
- A:  Sending: Any time link goes from uncontrollable to controllable.
- A: Receiving: Every 100 frames **when you have control of Link.**
- Q: **My partner did something but I don't see the change?!**
- A: Synced data doesn't take effect immediately if you're in the same zone due to engine limitations. Go through a loading zone to fix it.
- Q: **I'm doing the child trade quest and my partner still has the mask I just sold.**
- A: 'Sold Out' doesn't sync to prevent glitches that could lock you out of Mask of Truth. If you sold your mask you need to be the one that turns it in to the Happy Mask Salesman.
- Q: **I talked to the Scarecrow as child and he didn't let my partner finish the quest as adult.**
- A: Whoever starts the Scarecrow quest must be the one who finishes it to unlock Pierre.

#### Installation and usage
**YOU MUST BE USING BIZHAWK 2.3 OR HIGHER. YES, IT WILL CRASH IF YOU TRY OLDER VERSIONS.
**

The node side of this project can be run directly should you have it. Otherwise we offer precompiled binaries made using [pkg](https://github.com/zeit/pkg "pkg") that contain everything you need for Windows, Linux, and Mac. Get them on the release page.

Download the package for your operating system and extract it in your BizHawk folder (same level as the executable EmuHawk). Everything is already placed within the zip to end up in the correct place.

Configure your node: Open OotRandoCoop-config.ini in any text editor.

![config](https://i.imgur.com/YiMYEik.png "config")

#### Server Options:
- master_server_ip: IP address of game's 'host'. Leave it as 127.0.0.1 if you're hosting yourself.
- master_server_port: The port for the master server.
- master_server: Whether or not we should load the master server. Only enable this if you're hosting the game for others. ***The master server must have master_server_port open in their router.***

#### Client Options:
- nickname: Name other players see when connecting.

#### Tracker Options:
- enabled: Enable or disable the built in automated item tracker. The tracker can be accessed by going to http://localhost:8082 in a web browser.

![tracker](https://i.imgur.com/LTvTKhm.png)

Launch your node once you've finished configuring it by double clicking the OotRandoCoop executable file.

The node window looks like this:
![node](https://i.imgur.com/WukfhwG.png)) "node")

In Bizhawk, go to Config -> Customize -> Advanced and make sure Lua+LuaInterface is selected or this script **will not work**.

![Lua Configuration](https://i.imgur.com/izrsT5A.png "Lua Configuration")

Next open the Lua console via Tools -> Lua Console. Check the 'disable scripts on load' option.

![lua console 2](https://i.imgur.com/deFUwed.png "lua console 2")

Close the emulator once you've finished this step.

To load the co-op system into BizHawk you must pass it some arguments. 

##### Windows instructions:
Create a shortcut to EmuHawk.exe and edit the shortcut's properties via right click -> properties.

![shortcut](https://i.imgur.com/Cne6Azp.png)

These are the arguments you should copy/paste at the end of the Target field:  --socket_ip=127.0.0.1 --socket_port=1337 --luaconsole --lua=Lua/Oot_Rando_Coop.lua

Once you've saved this change open the emulator via your new shortcut. It should automatically open the Lua console.

![Lua Console](https://i.imgur.com/eLC0R0l.png "Lua Console")

Load your rom and once you can see the spinning N64 logo you can enable the script in the Lua console by double clicking it. You're now ready to load up a save file and play.

**Please note there will be a burst of lag the first time you load into the game. This is perfectly normal as the syncing system does its initial data collection.**

#### Technical Details
This system is in two parts
1. A lua script that runs inside the BizHawk Lua Console
2. A node js program that runs in the background.

The lua script mostly serves to read/write the game memory. The node program gets information from the lua script via local TCP socket (port 1337) and does all the heavy lifting.

When Link changes state (goes from uncontrollable to controllable) the lua script takes stock of what you have in your inventory and if something new is detected it sends that information up to node. Node will run some bit comparisons to ensure nothing is being regressively overwritten and sends that information to the master server and it will relay that data to all other players. Any new data that node receives from your partner is run through the same bit comparisons to ensure nothing is wrong and sends it to the lua script to be written back to the game. During this memory writing it also ensures your C buttons are properly updated in the event an item in a slot changed.

The same thing happens for world and quest state, but please keep in mind any changes made by the sync to the zone you're currently in **won't take effect until you pass through a loading zone.** This is a Zelda64 engine limitation.

