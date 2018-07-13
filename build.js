let concat = require('concat-files');

concat([
    './src/for_emulator/Lua/json.lua',
    './src/for_emulator/Lua/base64.lua',
    './src/for_emulator/Lua/sync_addresses.lua',
    './src/for_emulator/Lua/Oot_Rando_Coop.lua'
], './bin/Lua/Oot_Rando_Coop.lua', function(err) {
    if (err) throw err
    console.log('done');
});