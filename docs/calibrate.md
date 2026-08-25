Yes—if the player marker is offset from the player’s real location, you likely need
  to recalibrate.

  The current verificationPoints only contain the calculated corners and center. They
  prove that the JSON is internally consistent, but they do not prove that real Gateway
  landmarks align with the image.

  ### Recommended calibration process

  1. Choose at least 5 recognizable locations:
      - Near northwest corner
      - Northeast corner
      - Southwest corner
      - Southeast corner
      - Center
      - Preferably a few additional landmarks

  2. At every location, record:
      - Live game world.x and world.y
      - Corresponding pixel image.x and image.y in gateway-dark.png

  3. Determine axis directions:
      - Moving east increases world X → left-to-right
      - If it moves left instead → right-to-left
      - Moving south increases world Y → top-to-bottom
      - If it moves upward → bottom-to-top

  4. Calculate accurate worldBounds and replace the values in TPNIsleControlHUD/
     frontend/public/maps/gateway/calibration.json:4.

  5. Put your real landmark samples into verificationPoints, then test additional
     locations that were not used for calibration.

  The existing conversion supports translation, scaling, and axis flipping only. If one
  location aligns but others progressively drift or rotate, the map image needs an
  affine calibration—which requires updating TPNIsleControlHUD/frontend/src/features/
  minimap/calibration.ts:9, not just the JSON.

  Quick diagnosis:

  - Same offset everywhere → recalibrate bounds.
  - Correct center but wrong edges → incorrect scale/bounds.
  - Mirrored movement → change axes.
  - Correct in one region but rotated/skewed elsewhere → affine calibration required.
  - Marker jumps or moves in the wrong direction unpredictably → inspect the position
    source first.

  If you provide several samples as:

  worldX, worldY, imageX, imageY

  I can calculate the proper calibration values for you.