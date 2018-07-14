-- This stuff is untested and still janky. Leave it for later.
if (checkForSceneChange()) then
  local d = isSceneDungeon(last_scene);
  if (d ~= nil) then
    isInDungeon = true;
  else
    if (isInDungeon) then
      isInDungeon = false;
      dumpDungeonData();
      dumpDungeonKeys(d);
    end
  end
end