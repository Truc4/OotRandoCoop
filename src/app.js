/*Copyright 2018 Mathew Miller (denoflions)

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/

const VERSION = "@major@.@minor@.@buildNumber@";
console.log("Oot Rando Co-op Node v" + VERSION + " loading...");
console.log("Coded by: denoflions.");
console.log("Primary testers: Delphirus & Liberalpeacock");

// Requires
const restify = require('restify');
const fs = require("fs");
const net = require('net');
const uuidv4 = require('uuid/v4');
// This is how we tell players apart. This should always be unique.
const my_uuid = uuidv4() + "-" + new Date().getTime();
const serveStatic = require('serve-static-restify');
const ini = require('node-ini');
const WebSocket = require('ws');
const lzw = require("node-lzw");
const natUpnp = require('nat-upnp');

// Config

let cfg = ini.parseSync('./OotRandoCoop-config.ini');
let master_server_ip = cfg.Server.master_server_ip;
let master_server_port = cfg.Server.master_server_port;
console.log("Master Server IP: " + master_server_ip + ":" + master_server_port);
let isMaster = cfg.Server.master_server === "true";
let isTracker = cfg.Tracker.enabled === "true";
let nickname = cfg.Client.nickname;
console.log("My UUID: " + my_uuid);

let websocket = null;
if (isMaster) {
    console.log("Setting up master server...");
    master_server_ip = "127.0.0.1";

    let client = natUpnp.createClient();
    client.portMapping({
        public: master_server_port,
        private: master_server_port,
        ttl: 10
    }, function (err) {
        if (err) {
            console.log("Please open port " + master_server_port + " on your router in order to host a game.")
        } else {
            console.log("Port opened successfully!")
        }
    });

    const wss = new WebSocket.Server({port: master_server_port});

    wss.on('connection', function connection(ws) {
        ws.on('message', function incoming(data) {
            wss.clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        });
    });
}

function setupClient() {
    console.log("Setting up client...");
    const ws = new WebSocket('ws://' + master_server_ip + ":" + master_server_port);
    ws.on('error', function () {
        console.log("Failed to connect to master server. :(")
    });

    ws.on('open', function open() {
        try {
            console.log("Connected to master server!");
            sendJustText("Connected to master server!");
            websocket = ws;
        } catch (err) {
            if (err) {
                console.log(err);
            }
        }
    });

    ws.on('message', function incoming(data) {
        let parse = JSON.parse(lzw.decode(data));
        let incoming = parse.payload;
        if (incoming.hasOwnProperty("testing_flag")) {
            sendDataToMaster({testing_response: true, target_uuid: parse.uuid});
            return;
        } else if (incoming.hasOwnProperty("testing_response")) {
            sendJustText("Connected to partner: " + parse.nickname);
            return;
        } else if (incoming.hasOwnProperty("player_connecting")) {
            send({message: "Player connecting...", player_connecting: true});
            if (ScarecrowStorage !== null) {
                send({message: "Querying for Pierre data...", scarecrow: true});
            }
            return;
        }
        processData(incoming, parse.uuid);
    });
}

server = restify.createServer();
server.name = "Oot Randomizer Co-op";
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 8082, function () {
    console.log('%s listening to %s', server.name, server.url);
});

if (isTracker) {
    console.log("Setting up item tracker...");
    if (fs.existsSync("./overlay/overlay.html")) {
        server.pre(serveStatic('./overlay', {'index': ['overlay.html']}));
    }
    server.get('/oot/randomizer/data', function (req, res, next) {
        res.send(OotOverlay_data);
        next();
    });
}

function sendDataToMaster(data) {
    websocket.send(lzw.encode(JSON.stringify({uuid: my_uuid, nickname: nickname, payload: data})));
}

// Basic server for talking to Bizhawk.
let seed = 0;
let initial_setup_complete = false;

function processData(incoming, uuid) {
    let doesUpdate = true;
    if (incoming.hasOwnProperty("scene_data")) {
        if (!SceneStorage.hasOwnProperty("scene_data")) {
            doesUpdate = false;
        }
        updateScenes({
            addr: incoming.scene_data.addr,
            scene_data: incoming.scene_data.scene_data,
            uuid: uuid
        })
    }
    else if (incoming.hasOwnProperty("flag_data")) {
        if (!FlagStorage.hasOwnProperty("flag_data")) {
            doesUpdate = false;
        }
        Object.keys(incoming.flag_data).forEach(function (key) {
            updateFlags({addr: key, data: incoming.flag_data[key], uuid: uuid})
        });
    }
    else if (incoming.hasOwnProperty("skulltulas")) {
        if (!SkulltulaStorage.hasOwnProperty("skulltulas")) {
            doesUpdate = false;
        }
        Object.keys(incoming.skulltulas).forEach(function (key) {
            updateSkulltulas({addr: key, data: incoming.skulltulas[key], uuid: uuid})
        });
    } else if (incoming.hasOwnProperty("dungeon")) {
        // NYI
    } else if (incoming.hasOwnProperty("scarecrow_data")) {
        updateScarecrow({uuid: uuid, payload: incoming});
    } else if (incoming.hasOwnProperty("bottle")) {
        updateInventory({uuid: uuid, data: incoming.bottle});
    } else {
        if (OotStorage == null && !initial_setup_complete && uuid === my_uuid) {
            sendJustText("Loading initial game state...");
            OotStorage = incoming;
            updateBundles({uuid: uuid, data: incoming});
            updateInventory({uuid: uuid, data: incoming});
            overlayHandler(incoming);
            sendJustText("Checking for partner connection...");
            let test = {testing_flag: true};
            sendDataToMaster(test);
            setTimeout(function () {
                if (!isMaster) {
                    sendJustText("Sending sync request...");
                    sendDataToMaster({player_connecting: true});
                }
                initial_setup_complete = true;
            }, 10000);
            doesUpdate = false;
            return doesUpdate;
        } else {
            if (initial_setup_complete) {
                updateInventory({uuid: uuid, data: incoming});
                updateBundles({uuid: uuid, data: incoming});
                overlayHandler(incoming);
            }
        }
    }
    return doesUpdate;
}

function parseData(data) {
    var unpack = null;
    try {
        unpack = JSON.parse(data);
        let decode = Buffer.from(unpack.data, 'base64');
        let incoming = JSON.parse(decode);
        if (incoming.hasOwnProperty("seed")) {
            seed = incoming.seed;
            console.log("Randomizer seed: " + seed);
            return;
        }
        if (processData(incoming, my_uuid)) {
            sendDataToMaster(incoming);
        }
    } catch (err) {
        if (err) {
            console.log(err);
            console.log("---------------------");
            console.log("Something went wrong!");
            console.log("---------------------");
            console.log(data);
        }
    }
}

let emuhawk = null;
let packet_buffer = "";

let zServer = net.createServer(function (socket) {
    console.log("Connected to BizHawk!");
    emuhawk = socket;
    sendJustText("Connected to node!");
    setupClient();
    socket.setEncoding('ascii');
    socket.on('data', function (data) {
        try {
            let dataStream = data.split("\r\n");
            for (let i = 0; i < dataStream.length; i++) {
                if (dataStream[i] === "") {
                    continue;
                }
                // This shit literally only triggers on Pierre's data because its comically huge by Oot standards.
                if (dataStream[i].indexOf("}") === -1) {
                    // Incomplete data.
                    packet_buffer = dataStream[i];
                    continue;
                } else if (dataStream[i].indexOf("{") === -1) {
                    // This must be the other half.
                    packet_buffer += dataStream[i];
                } else {
                    packet_buffer = dataStream[i];
                }
                parseData(packet_buffer);
            }
        } catch (err) {
            if (err) {
                console.log(err);
                console.log("---------------------");
                console.log("Something went wrong!");
                console.log("---------------------");
                console.log(packet_buffer);
                packet_buffer = "";
            }
        }
    });
});

zServer.listen(1337, '127.0.0.1', function () {
    console.log("Awaiting connection. Please load the .lua script in Bizhawk.");
});

server.get('/oot/randomizer/awaiting', function (req, res, next) {
    res.send(awaiting_send);
    awaiting_send.length = 0;
    next();
});

let awaiting_send = [];

function send(data) {
    let json = JSON.stringify(data);
    let packet = Buffer.from(json).toString('base64');
    awaiting_send.push(packet);
}

function sendJustText(text) {
    send({message: text, payload: {}});
}

let key_translations = {};

function registerKeyTranslation(key, translation) {
    key_translations[key] = translation;
}

function getKeyTranslation(key, int) {
    if (key_translations.hasOwnProperty(key)) {
        if (typeof key_translations[key] === 'function') {
            return key_translations[key](int);
        } else {
            return key_translations[key];
        }
    } else {
        return key;
    }
}

// Oot inventory and world state management.
let OotStorage = null;
let OotOverlay_data = {};
let SceneStorage = {};
let FlagStorage = {};
let SkulltulaStorage = {};
// Pierre takes up so much space he deserves his own object... lol.
let ScarecrowStorage = null;

let inventory_keys = ["ctrade", "atrade", "lens", "ocarina", "stick", "fwind", "bottle1", "iarrow", "farrow", "hammer", "nuts", "larrow", "boomerang", "nlove", "bow", "bottle2", "bombchu", "bombs", "bottle4", "bottle3", "dins", "slingshot", "hookshot", "beans"];
let inventory_blank = 255;
let boolean_keys = ["magic_bool", "biggeron_flag", "defense"];
let int_keys = ["hearts", "magic_size", "magic_limit"];

let tunic_targets = {green: 7, red: 6, blue: 5};

registerKeyTranslation("green", "Kokiri Tunic");
registerKeyTranslation("red", "Goron Tunic");
registerKeyTranslation("blue", "Zora Tunic");

registerKeyTranslation("ctrade", function (int) {
    switch (int) {
        case 33:
            return "Egg (Child)";
        case 34:
            return "Cucco (Child)";
        case 35:
            return "Zelda's Letter";
        case 36:
            return "Keaton Mask";
        case 37:
            return "Skull Mask";
        case 38:
            return "Spooky Mask";
        case 39:
            return "Bunny Hood";
        case 40:
            return "Goron Mask";
        case 41:
            return "Zora Mask";
        case 42:
            return "Gerudo Mask";
        case 43:
            return "Mask of Truth";
        case 44:
            return "Sold Out";
    }
});
registerKeyTranslation("atrade", function (int) {
    switch (int) {
        case 45:
            return "Egg (Adult)";
        case 46:
            return "Chicken (Adult)";
        case 47:
            return "Cojiro";
        case 48:
            return "Odd Mushroom";
        case 49:
            return "Odd Potion";
        case 50:
            return "Poacher's Saw";
        case 51:
            return "Broken Sword";
        case 52:
            return "Prescription";
        case 53:
            return "Eyeball Frog";
        case 54:
            return "Eye Drops";
        case 55:
            return "Claim Check";
    }
});
registerKeyTranslation("ocarina", "Ocarina");
registerKeyTranslation("lens", "Lens of Truth");
registerKeyTranslation("stick", "Deku Stick");
registerKeyTranslation("nuts", "Deku Nuts");
registerKeyTranslation("fwind", "Farore's Wind");

function bottleTranslation(int) {
    switch (int) {
        case 20:
            return "Empty Bottle";
        case 21:
            return "Red Potion";
        case 22:
            return "Green Potion";
        case 23:
            return "Blue Potion";
        case 24:
            return "Bottled Fairy";
        case 25:
            return "Bottled Fish";
        case 26:
            return "Bottle of Milk";
        case 31:
            return "Bottle of Milk (Half)";
        case 27:
            return "Ruto's Letter";
        case 28:
            return "Blue Fire";
        case 29:
            return "Bottled Bugs";
        case 30:
            return "Bottled Poe";
        case 32:
            return "Bottled Poe";
    }
}

registerKeyTranslation("bottle1", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle2", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle3", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("bottle4", function (int) {
    return bottleTranslation(int);
});
registerKeyTranslation("iarrow", "Ice Arrows");
registerKeyTranslation("farrow", "Fire Arrows");
registerKeyTranslation("hammer", "Megaton Hammer");
registerKeyTranslation("larrow", "Light Arrows");
registerKeyTranslation("boomerang", "Boomerang");
registerKeyTranslation("nlove", "Nayru's Love");
registerKeyTranslation("bow", "Fairy Bow");
registerKeyTranslation("bombchu", "Bombchus");
registerKeyTranslation("bombs", "Bombs");
registerKeyTranslation("dins", "Din's Fire");
registerKeyTranslation("slingshot", "Slingshot");
registerKeyTranslation("hookshot", function (int) {
    switch (int) {
        case 10:
            return "Hookshot";
        case 11:
            return "Longshot";
    }
});
registerKeyTranslation("beans", "Magic Beans");
registerKeyTranslation("magic_bool", "Magic Meter");
registerKeyTranslation("biggeron_flag", "Biggoron's Sword");
registerKeyTranslation("defense", "Enhanced Defense");
registerKeyTranslation("hearts", "Heart Container");
registerKeyTranslation("magic_size", "Enhanced Magic Meter");
registerKeyTranslation("magic_limit", function (data) {
    switch (data) {
        case 30:
            return "Standard Magic Meter Capacity";
        case 60:
            return "Enhanced Magic Meter Capacity";
        default:
            return "";
    }
});

function overlayHandler(data) {
    OotOverlay_data["skull_tokens_count"] = data["skull_tokens_count"];
}

let int_special_handlers = {};

function registerSpecialIntHandler(key, callback) {
    int_special_handlers[key] = callback;
    //console.log("Registered int handler for key " + key + ".");
}

registerSpecialIntHandler("magic_size", function (key, pack) {
    if (my_uuid !== pack["uuid"]) {
        let r2 = {message: "Filling up your magic...", payload: {magic_pool: 0x60}};
        send(r2);
    }
});

registerSpecialIntHandler("hearts", function (key, pack) {
    if (my_uuid !== pack["uuid"]) {
        let r2 = {
            message: "Filling up your health due to gaining a heart container...",
            payload: {heal: 101}
        };
        send(r2);
    }
});

function intHandler(pack) {
    let data = pack.data;
    let flag = false;
    try {
        Object.keys(int_keys).forEach(function (key) {
            let v = int_keys[key];
            if (!OotStorage.hasOwnProperty(v)) {
                OotStorage[v] = data[v];
                OotOverlay_data[v] = OotStorage[v];
            }
            if ((OotStorage[v] < data[v])) {
                flag = true;
                OotStorage[v] = data[v];
                if (my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(v, data[v]) + ".", payload: {}};
                    r.payload[v] = OotStorage[v];
                    send(r);
                }
                OotOverlay_data[v] = OotStorage[v];
                if (int_special_handlers.hasOwnProperty(v)) {
                    int_special_handlers[v](v, pack);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

let bool_special_handlers = {};

function registerSpecialBoolHandler(key, callback) {
    bool_special_handlers[key] = callback;
    //console.log("Registered bool handler for key " + key + ".");
}

registerSpecialBoolHandler("magic_bool", function (key, pack) {
    if (my_uuid !== pack["uuid"]) {
        let r2 = {message: "Filling up your magic...", payload: {magic_pool: 0x30}};
        send(r2);
    }
});

function boolHandler(pack) {
    let flag = false;
    let data = pack.data;
    try {
        Object.keys(boolean_keys).forEach(function (key) {
            let v = boolean_keys[key];
            if ((OotStorage[v] === 0 && data[v] !== 0)) {
                flag = true;
                OotStorage[v] = data[v];
                if (my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(v, data[v]) + ".", payload: {}};
                    r.payload[v] = OotStorage[v];
                    send(r);
                }
                OotOverlay_data[v] = (OotStorage[v] === 1);
                if (bool_special_handlers.hasOwnProperty(v)) {
                    bool_special_handlers[v](v, pack);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

function genericBundleHandler(pack, keyMap, storageKey) {
    let flag = false;
    let data = pack.data;
    try {
        if (!OotStorage.hasOwnProperty(storageKey)) {
            OotStorage[storageKey] = [];
        }
        Object.keys(keyMap).forEach(function (key) {
            let bit = keyMap[key];
            if ((OotStorage[storageKey][bit] === 0 && data[storageKey][bit] === 1)) {
                flag = true;
                OotStorage[storageKey][bit] = data[storageKey][bit];
                if (my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(key, data[storageKey][bit]) + ".", payload: {}};
                    r.payload[storageKey] = OotStorage[storageKey];
                    send(r);
                }
                if (OotStorage[storageKey][bit] === 1) {
                    console.log("Yes " + key);
                    OotOverlay_data[key] = true;
                } else {
                    console.log("No " + key);
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
            console.log(pack);
        }
    }
    return flag;
}

function tunicHandler(data) {
    return genericBundleHandler(data, tunic_targets, "tunics");
}

let boot_targets = {boots: 3, iron: 2, hover: 1};

registerKeyTranslation("boots", "Kokiri Boots");
registerKeyTranslation("iron", "Iron Boots");
registerKeyTranslation("hover", "Hover Boots");

function bootHandler(data) {
    return genericBundleHandler(data, boot_targets, "tunics");
}

let sword_targets = {kokori: 7, master: 6, giants: 5, broken: 4};

registerKeyTranslation("kokori", "Kokiri Sword");
registerKeyTranslation("master", "Master Sword");
registerKeyTranslation("giants", "Giant's Knife");
registerKeyTranslation("broken", "Broken Sword");

function swordHandler(data) {
    return genericBundleHandler(data, sword_targets, "swords");
}

let shield_targets = {deku: 3, hylian: 2, mirror: 1};

registerKeyTranslation("deku", "Deku Shield");
registerKeyTranslation("hylian", "Hylian Shield");
registerKeyTranslation("mirror", "Mirror Shield");

function shieldHandler(data) {
    return genericBundleHandler(data, shield_targets, "swords");
}

let upgrade_amount_overrides = {};

function genericUpgradeHandler(pack, targets, storageKey, payloads) {
    let flag = false;
    let data = pack.data;
    try {
        Object.keys(targets).forEach(function (key) {
            let current = [];
            let incoming = [];
            targets[key].forEach(function (value) {
                current.push(Number(OotStorage[storageKey][value]));
                incoming.push(Number(data[storageKey][value]));
            });
            let ourLevel = 0;
            let theirLevel = 0;
            Object.keys(payloads[key]).forEach(function (key2) {
                let comparison = payloads[key][key2];
                if (arrayComparison(current, comparison)) {
                    ourLevel = key2;
                }
                if (arrayComparison(comparison, incoming)) {
                    theirLevel = key2;
                }
            });
            if ((Number(theirLevel) > Number(ourLevel))) {
                let startingBit = 0;
                targets[key].forEach(function (value) {
                    OotStorage[storageKey][value] = incoming[startingBit];
                    startingBit++;
                });
                flag = true;
                console.log(key + " " + theirLevel);
                if (my_uuid !== pack["uuid"]) {
                    let k = key + " " + theirLevel;
                    let r = {
                        message: "Received " + getKeyTranslation(key + "_u", Number(theirLevel)) + ".",
                        payload: {}
                    };
                    r.payload[storageKey] = OotStorage[storageKey];
                    if (!upgrade_no_increase.contains(k)) {
                        r.payload[key + "_count"] = Number(theirLevel);
                        if (upgrade_amount_overrides.hasOwnProperty(key)) {
                            if (upgrade_amount_overrides[key].hasOwnProperty(theirLevel)) {
                                r.payload[key + "_count"] = Number(upgrade_amount_overrides[key][Number(theirLevel)]);
                            }
                        }
                    }
                    send(r);
                }
                if (theirLevel > 0) {
                    OotOverlay_data[key + "_upgrade"] = theirLevel;
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

let upgrade_1_targets = {nuts: [1, 2, 3], stick: [4, 5, 6]};
let upgrade_1_payloads = {
    nuts: {0: [0, 0, 0], 20: [0, 0, 1], 30: [0, 1, 0], 40: [0, 1, 1]},
    stick: {0: [0, 0, 0], 10: [0, 0, 1], 20: [0, 1, 0], 30: [0, 1, 1]}
};
let upgrade_3_targets = {strength: [0, 1, 2], bomb: [3, 4], arrows: [6, 7]};
let upgrade_3_payloads = {
    strength: {0: [0, 0, 0], 1: [0, 1, 0], 2: [1, 0, 0], 3: [1, 1, 0]},
    bomb: {0: [0, 0], 20: [0, 1], 30: [1, 0], 40: [1, 1]},
    arrows: {0: [0, 0], 30: [0, 1], 40: [1, 0], 50: [1, 1]}
};
let upgrade_2_targets = {bullet: [0, 1], wallet: [2, 3], scale: [5, 6]};
let upgrade_2_payloads = {
    bullet: {0: [0, 0], 30: [0, 1], 40: [1, 0], 50: [1, 1]},
    wallet: {99: [0, 0], 200: [0, 1], 500: [1, 0]},
    scale: {0: [0, 0], 1: [0, 1], 2: [1, 0]}
};

registerKeyTranslation("nuts_u", function (value) {
    return "Deku Nut Upgrade (" + value + ")"
});
registerKeyTranslation("stick_u", function (value) {
    return "Deku Stick Upgrade (" + value + ")";
});
registerKeyTranslation("strength_u", function (value) {
    console.log("strength_u " + value);
    switch (value) {
        case 1:
            return "Goron Braclet";
        case 2:
            return "Silver Gauntlets";
        case 3:
            return "Golden Gauntlets";
    }
});
registerKeyTranslation("bomb_u", function (value) {
    return "Bomb Bag (" + value + ")";
});
registerKeyTranslation("arrows_u", function (value) {
    return "Quiver (" + value + ")";
});
registerKeyTranslation("bullet_u", function (value) {
    return "Bullet Bag (" + value + ")";
});
registerKeyTranslation("wallet_u", function (value) {
    switch (value) {
        case 99:
            return "Wallet";
        case 200:
            return "Adult's Wallet";
        case 500:
            return "Giant's Wallet";
    }
});
registerKeyTranslation("scale_u", function (value) {
    switch (value) {
        case 1:
            return "Silver Scale";
        case 2:
            return "Golden Scale";
    }
});

upgrade_amount_overrides["stick"] = {10: 1};
upgrade_amount_overrides["nuts"] = {20: 5};

let upgrade_no_increase = [
    "stick 0", "bomb 0", "arrows 0", "bullet 0", "nuts 0"
];

function upgrade_handler(data) {
    let flag = false;
    if (genericUpgradeHandler(data, upgrade_1_targets, "upgrades_1", upgrade_1_payloads)) {
        flag = true;
    }
    if (genericUpgradeHandler(data, upgrade_2_targets, "upgrades_2", upgrade_2_payloads)) {
        flag = true;
    }
    if (genericUpgradeHandler(data, upgrade_3_targets, "upgrades_3", upgrade_3_payloads)) {
        flag = true;
    }
    return flag;
}

let quest_1_targets = {
    song_of_time: 7,
    song_of_storms: 6,
    emerald: 5,
    ruby: 4,
    sapphire: 3,
    stone: 2,
    card: 1,
    skulltula_flag: 0
};
let quest_2_targets = {serenade: 7, requiem: 6, nocturn: 5, prelude: 4, lullaby: 3, epona: 2, saria: 1, sun: 0};
let quest_3_targets = {forest: 7, fire: 6, water: 5, spirit: 4, shadow: 3, light: 2, minuet: 1, bolero: 0};

registerKeyTranslation("song_of_time", "Song of Time");
registerKeyTranslation("song_of_storms", "Song of Storms");
registerKeyTranslation("emerald", "Kokiri Emerald");
registerKeyTranslation("ruby", "Goron Ruby");
registerKeyTranslation("sapphire", "Zora's Sapphire");
registerKeyTranslation("stone", "Stone of Agony");
registerKeyTranslation("card", "Gerudo Membership Card");
registerKeyTranslation("skulltula_flag", "Skulltulas");
registerKeyTranslation("serenade", "Serenade of Water");
registerKeyTranslation("requiem", "Requiem of Spirit");
registerKeyTranslation("nocturn", "Nocturn of Shadow");
registerKeyTranslation("prelude", "Prelude of Light");
registerKeyTranslation("lullaby", "Zelda's Lullaby");
registerKeyTranslation("epona", "Epona's Song");
registerKeyTranslation("saria", "Saria's Song");
registerKeyTranslation("sun", "Sun's Song");
registerKeyTranslation("forest", "Forest Medallion");
registerKeyTranslation("fire", "Fire Medallion");
registerKeyTranslation("water", "Water Medallion");
registerKeyTranslation("spirit", "Spirit Medallion");
registerKeyTranslation("shadow", "Shadow Medallion");
registerKeyTranslation("light", "Light Medallion");
registerKeyTranslation("minuet", "Minuet of the Forest");
registerKeyTranslation("bolero", "Bolero of Fire");

function quest_handler(data) {
    let flag = false;
    if (genericBundleHandler(data, quest_1_targets, "quest_1")) {
        flag = true;
    }
    if (genericBundleHandler(data, quest_2_targets, "quest_2")) {
        flag = true;
    }
    if (genericBundleHandler(data, quest_3_targets, "quest_3")) {
        flag = true;
    }
    return flag;
}

let inventory_special_handlers = {};

function registerInventoryHandler(key, callback) {
    inventory_special_handlers[key] = callback;
    //console.log("Registered inventory handler for key " + key + ".");
}

registerInventoryHandler("basic_handler", function (key, value, data) {
    if (value === inventory_blank && data[key] !== inventory_blank) {
        return true;
    }
    return value !== inventory_blank && (data[key] > value && data[key] !== inventory_blank);
});

let child_trade_status = 0;

registerInventoryHandler("ctrade", function (key, value, data) {
    if (value === inventory_blank) {
        child_trade_status = data[key];
        return inventory_special_handlers["basic_handler"](key, value, data);
    } else {
        if (child_trade_status === 0) {
            child_trade_status = OotStorage[key];
            console.log("Child trade quest set to " + child_trade_status + ".");
        }
        if (value !== inventory_blank && data[key] > value && child_trade_status < data[key] && data[key] !== inventory_blank) {
            if (data[key] !== 44) {
                // mask is newer but not sold out.
                child_trade_status = data[key];
                console.log("Child trade quest advanced to " + child_trade_status + ".");
                return true;
            }
        }
    }
    return false;
});

function bottleHandler(key, value, data) {
    if (value === inventory_blank) {
        return inventory_special_handlers["basic_handler"](key, value, data);
    }
    return value !== inventory_blank && value !== data[key] && data[key] !== inventory_blank;
}

registerInventoryHandler("bottle1", bottleHandler);
registerInventoryHandler("bottle2", bottleHandler);
registerInventoryHandler("bottle3", bottleHandler);
registerInventoryHandler("bottle4", bottleHandler);

let inventory_amount_handlers = {};

function registerInventoryAmountHandler(key, callback) {
    inventory_amount_handlers[key] = callback;
    //console.log("Registered inventory # handler for key " + key + ".");
}

registerInventoryAmountHandler("bombchu", function () {
    return 10;
});

function updateInventory(pack) {
    let data = pack.data;
    try {
        Object.keys(data).forEach(function (k) {
            // The idea here is the client can send incomplete inventory updates when necessary.
            // Check the incoming packet against the valid inventory array. If indexOf is -1 the data is useless and should be discarded.
            // This can happen when something changes that we know about but don't necessarily care about right now like bomb count.
            let key = inventory_keys.indexOf(k);
            if (key === -1) {
                // return is more or less 'continue' when in JS foreach loops...
                return;
            }
            if (!OotStorage.hasOwnProperty(inventory_keys[key])) {
                OotStorage[inventory_keys[key]] = data[inventory_keys[key]];
                console.log("Setting value for inventory key: " + inventory_keys[key] + ".");
                OotOverlay_data[inventory_keys[key]] = data[inventory_keys[key]];
            }
            let val = OotStorage[inventory_keys[key]];
            let handler = "basic_handler";
            if (inventory_special_handlers.hasOwnProperty(inventory_keys[key])) {
                handler = inventory_keys[key];
            }
            if (inventory_special_handlers[handler](inventory_keys[key], val, data)) {
                OotStorage[inventory_keys[key]] = data[inventory_keys[key]];
                val = OotStorage[inventory_keys[key]];
                if (my_uuid !== pack["uuid"]) {
                    let r = {message: "Received " + getKeyTranslation(inventory_keys[key], val) + ".", payload: {}};
                    r.payload[inventory_keys[key]] = data[inventory_keys[key]];
                    if (inventory_amount_handlers.hasOwnProperty(inventory_keys[key])) {
                        r.payload[inventory_keys[key] + "_count"] = inventory_amount_handlers[inventory_keys[key]]();
                    }
                    console.log(r);
                    send(r);
                }
                if (OotStorage[inventory_keys[key]] !== 255) {
                    OotOverlay_data[inventory_keys[key]] = data[inventory_keys[key]];
                }
            }
        });
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
}

function updateBundles(data) {
    tunicHandler(data);
    bootHandler(data);
    swordHandler(data);
    shieldHandler(data);
    upgrade_handler(data);
    quest_handler(data);
    boolHandler(data);
    intHandler(data);
}

// Thanks to Delph for having the patience to sort these out.
let scene_translations = {
    "0x11AB04": "Mido's House",
    "0x11A6A4": "Great Deku Tree",
    "0x11AB90": "Kokiri Shop",
    "0x11AEF4": "Lon Lon Ranch",
    "0x11AFF0": "Kokiri Forest",
    "0x11B00C": "Sacred Forest Meadow",
    "0x11B07C": "Gerudo Valley",
    "0x11B108": "Hyrule Castle (Child)",
    "0x11A730": "Water Temple",
    "0x11A768": "Shadow Temple",
    "0x11A6DC": "Jabu Jabu",
    "0x11A6C0": "Dodongo's Cavern",
    "0x11A6F8": "Forest Temple",
    "0x11A714": "Fire Temple",
    "0x11B124": "Death Mountain Trail",
    "0x11AD6C": "Grotto",
    "0x11B15C": "Goron City",
    "0x11A74C": "Spirit Temple",
    "0x11B0B4": "Desert Colossus",
    "0x11A784": "Bottom of the Well",
    "0x11A7A0": "Ice Cavern",
    "0x11B060": "Zora's Fountain",
    "0x11A7BC": "Gerudo Training Grounds",
    "0x11A7D8": "Gerudo Fortress",
    "0x11B0EC": "Haunted Wasteland",
    "0x11A7F4": "Thieves' Hideout",
    "0x11AFB8": "Graveyard",
    "0x11B194": "Ganon's Castle Exterior",
    "0x11A810": "Ganon's Castle",
    "0x11B140": "Death Mountain Crater",
    "0x11B044": "Zora's Domain",
    "0x11AF80": "Hyrule Field",
    "0x11AEBC": "Zelda's Courtyard",
    "0x11ADC0": "Royal Family's Tomb",
    "0x11ACA8": "Impa's House"
};

function getSceneTranslation(addr) {
    if (scene_translations.hasOwnProperty(addr)) {
        return scene_translations[addr]
    } else {
        return addr;
    }
}

function updateScenes(data) {
    if (!SceneStorage.hasOwnProperty("scene_data")) {
        SceneStorage["scene_data"] = {};
        console.log("Creating scene data table.")
    }
    if (!SceneStorage["scene_data"].hasOwnProperty(data.addr)) {
        SceneStorage["scene_data"][data.addr] = data.scene_data;
        console.log("Writing initial scene data for address " + data.addr + ".");
        return false;
    }
    let flag = false;
    let list = [];
    try {
        Object.keys(SceneStorage["scene_data"][data.addr]).forEach(function (k2) {
            for (let i = 0; i < SceneStorage["scene_data"][data.addr][k2].length; i++) {
                if (SceneStorage["scene_data"][data.addr][k2][i] === 0 && data["scene_data"][k2][i] === 1) {
                    SceneStorage["scene_data"][data.addr][k2][i] = data["scene_data"][k2][i];
                    flag = true;
                    list.push(k2 + " | " + i);
                }
            }
        });
        if (flag) {
            let r = {
                message: "Received scene update: " + getSceneTranslation(data.addr),
                addr: data.addr,
                scene_data: {}
            };
            if (my_uuid !== data["uuid"]) {
                r["scene_data"] = SceneStorage["scene_data"][data.addr];
                send(r);
            }
            console.log("Scene Update required! " + data.addr);
            for (let i = 0; i < list.length; i++) {
                //sendJustText(list[i]);
                console.log(list[i]);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return flag;
}

function updateSkulltulas(s) {
    if (!SkulltulaStorage.hasOwnProperty("skulltulas")) {
        SkulltulaStorage["skulltulas"] = {};
        SkulltulaStorage["skull_tokens_count"] = 0;
        console.log("Creating skulltula storage table...")
    }
    if (!SkulltulaStorage.skulltulas.hasOwnProperty(s.addr)) {
        SkulltulaStorage.skulltulas[s.addr] = s.data;
        console.log("Writing initial skulltula data for address " + s.addr + ".");
        return false;
    }
    let list = [];
    let update_required = false;
    try {
        for (let i = 0; i < SkulltulaStorage.skulltulas[s.addr].length; i++) {
            if (SkulltulaStorage.skulltulas[s.addr][i] === 0 && s.data[i] === 1) {
                SkulltulaStorage.skulltulas[s.addr][i] = s.data[i];
                update_required = true;
                list.push(s.addr + " | " + i);
            }
        }
        if (update_required) {
            // This is dupe prevention. Should a player dupe a skulltula by standing in the same room as their partner their balance will be corrected as soon as they pass through a loading zone.
            // Skulltula destruction is stored in one byte per scene. Count the bits that are 1 to get the true Skulltula count.
            let scount = 0;
            Object.keys(SkulltulaStorage.skulltulas).forEach(function (addr) {
                for (let i = 0; i < SkulltulaStorage.skulltulas[addr].length; i++) {
                    if (SkulltulaStorage.skulltulas[addr][i] === 1) {
                        scount++;
                    }
                }
            });
            if (scount > SkulltulaStorage.skull_tokens_count) {
                console.log("New Skulltula count: " + scount);
                SkulltulaStorage.skull_tokens_count = scount;
            } else {
                scount = SkulltulaStorage.skull_tokens_count;
            }
            if (my_uuid !== s["uuid"]) {
                let r = {
                    message: "New Skulltula Count: " + scount,
                    addr: s.addr,
                    skulltulas: {},
                    skull_tokens_count: scount
                };
                r["skulltulas"] = SkulltulaStorage["skulltulas"][s.addr];
                send(r);
            }
            console.log("Skulltula Update required! " + s.addr);
            for (let k = 0; k < list.length; k++) {
                //sendJustText(list[k]);
                console.log(list[k]);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
    return update_required;
}

let flag_event_triggers = {};

function createFlagEventTrigger(addr, callback) {
    flag_event_triggers[addr] = callback;
    //console.log("Creating flag event trigger for address " + addr + ".");
}

createFlagEventTrigger("0x11b4b6", function (data) {
    // This is the flag when a player talks to Pierre as adult after having talked to him as child.
    if (data.data[3] === 1) {
        if (data["uuid"] === my_uuid) {
            sendJustText("Scarecrow's song detected.");
            sendJustText("Incoming lag spike.");
            setTimeout(function () {
                send({message: "Querying for Pierre data...", scarecrow: true});
            }, 30000);
        }
    }
});

createFlagEventTrigger("0x11b4a6", function (data) {
    // This is Epona.
    if (data.data[7] === 1) {
        if (data["uuid"] !== my_uuid) {
            sendJustText("Your partner acquired Epona.");
            sendJustText("If she won't come when you play the song...");
            sendJustText("... enter and exit Lon Lon Ranch.")
        } else {
            sendJustText("Epona acquired.");
        }
    }
});

function updateScarecrow(data) {
    try {
        if (ScarecrowStorage === null) {
            ScarecrowStorage = {};
            ScarecrowStorage = data.payload.scarecrow_data;
            if (data["uuid"] !== my_uuid) {
                sendJustText("Scarecrow's song detected.");
                sendJustText("Incoming lag spike.");
                setTimeout(function () {
                    send({message: "Updating Pierre data...", pierre: ScarecrowStorage});
                    sendJustText("Save warp required to enable Pierre.");
                }, 30000);
            }
        }
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
}

function updateFlags(flag) {
    if (!FlagStorage.hasOwnProperty("flag_data")) {
        FlagStorage["flag_data"] = {};
        console.log("Creating flag data table...");
    }
    if (!FlagStorage.flag_data.hasOwnProperty(flag.addr)) {
        FlagStorage["flag_data"][flag.addr] = flag.data;
        console.log("Writing initial flag data for address " + flag.addr + ".");
        return false;
    }
    let list = [];
    let update_required = false;
    try {
        for (let i = 0; i < FlagStorage["flag_data"][flag.addr].length; i++) {
            if (FlagStorage["flag_data"][flag.addr][i] === 0 && flag.data[i] === 1) {
                FlagStorage["flag_data"][flag.addr][i] = flag.data[i];
                update_required = true;
                list.push(flag.addr + " | " + i);
            }
        }
        if (update_required) {
            if (my_uuid !== flag["uuid"]) {
                let r = {message: "Flag update received: " + flag.addr + ".", addr: flag.addr, flag_data: {}};
                r["flag_data"] = FlagStorage["flag_data"][flag.addr];
                send(r);
            }
            console.log("Flag Update required! " + flag.addr);
            for (let k = 0; k < list.length; k++) {
                //sendJustText(list[k]);
                console.log(list[k]);
            }
            if (flag_event_triggers.hasOwnProperty(flag.addr)) {
                flag_event_triggers[flag.addr](flag);
            }
        }
    } catch (err) {
        console.log(err);
    }
    return update_required;
}

// Generic helpers

function writeSave(f) {
    fs.writeFile(f, JSON.stringify(OotStorage), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

function is(a, b) {
    return a === b && (a !== 0 || 1 / a === 1 / b) // false for +0 vs -0
        || a !== a && b !== b; // true for NaN vs NaN
}

Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

function arrayComparison(arr1, arr2) {
    if (arr1.length === arr2.length
        && arr1.every(function (u, i) {
            // Use "is" instead of "==="
            return is(u, arr2[i]);
        })
    ) {
        return true;
    } else {
        return false;
    }
}