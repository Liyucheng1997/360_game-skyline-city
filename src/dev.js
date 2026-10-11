// 开发调试辅助（仅开发模式加载）
window.__setup = () => {
  const G = window.__game; G.newGame(); G.start();
  const C = G.city; C.money = 1e6; C.maxPop = 99999;
  const road = (pts) => C.buildRoads(pts);
  let a = []; for (let x = 5; x < 30; x++) a.push([x, 30]); road(a);
  a = []; for (let z = 18; z < 44; z++) a.push([15, z]); road(a);
  a = []; for (let z = 18; z < 44; z++) a.push([24, z]); road(a);
  a = []; for (let x = 15; x <= 24; x++) a.push([x, 24]); road(a);
  a = []; for (let x = 15; x <= 24; x++) a.push([x, 36]); road(a);
  C.placeSpecial('coal', 9, 28); C.placeSpecial('wind', 13, 29); C.placeSpecial('park', 16, 26); C.placeSpecial('school', 17, 28); C.placeSpecial('ferris', 21, 28);
  const T = []; for (let z = 18; z < 44; z++) for (let x = 10; x < 30; x++) T.push([x, z]);
  C.zoneArea(T.filter((t) => t[1] < 30), 'R'); C.zoneArea(T.filter((t) => t[1] > 30 && t[0] < 20), 'C'); C.zoneArea(T.filter((t) => t[1] > 30 && t[0] >= 20), 'I');
  a = []; for (let x = 30; x < 60; x++) a.push([x, 30]); road(a);
  a = []; for (let z = 18; z < 44; z++) a.push([38, z]); road(a);
  C.placeSpecial('plaza', 31, 28); C.placeSpecial('hospital', 34, 28); C.placeSpecial('police', 36, 29); C.placeSpecial('fire', 37, 29);
  C.placeSpecial('tower', 39, 29); C.placeSpecial('stadium', 41, 28); C.placeSpecial('solar', 31, 31); C.placeSpecial('ferris', 34, 31);
  C.placeSpecial('school', 36, 31);
  for (let i = 0; i < 150; i++) C.hourTick();
  document.querySelector('#modal').classList.add('hidden');
  document.querySelector('#quests').classList.add('hidden');
  G.setSpeed(0);
};
window.__cam = (x, z, dx, h, dz, hour) => {
  const E = window.__game.env; const tw = (v) => v + 0.5 - 32;
  E.controls.target.set(tw(x), 0, tw(z)); E.camera.position.set(tw(x) + dx, h, tw(z) + dz); E.controls.update();
  if (hour != null) window.__game.city.minute = hour * 60;
};
// 在后台标签页中手动推进若干帧
window.__run = (sec = 2, fps = 30) => {
  const G = window.__game;
  const orig = G.clock.getDelta.bind(G.clock);
  G.clock.getDelta = () => 1 / fps;
  for (let i = 0; i < sec * fps; i++) G.frame();
  G.clock.getDelta = orig;
};
// 压力测试：铺满道路网格与区划
window.__stress = () => {
  const G = window.__game; G.newGame(); G.start();
  const C = G.city; C.money = 1e8; C.maxPop = 99999;
  for (let z = 2; z < 62; z += 3) { const a = []; for (let x = 0; x < 64; x++) a.push([x, z]); C.buildRoads(a); }
  for (let x = 2; x < 62; x += 5) { const a = []; for (let z = 0; z < 64; z++) a.push([x, z]); C.buildRoads(a); }
  const a = []; for (let x = 0; x < 64; x++) a.push([x, 30]); C.buildRoads(a);
  for (let k = 0; k < 12; k++) C.placeSpecial('coal', 4 + k * 5, 0);
  const T = []; for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) T.push([x, z]);
  C.zoneArea(T.filter((t) => t[0] < 22), 'R'); C.zoneArea(T.filter((t) => t[0] >= 22 && t[0] < 40), 'C'); C.zoneArea(T.filter((t) => t[0] >= 40), 'I');
  for (let i = 0; i < 600; i++) C.hourTick();
  document.querySelector('#modal').classList.add('hidden');
};
window.__perf = () => {
  const G = window.__game; const r = G.env.renderer;
  const t0 = performance.now(); window.__run(2); const t1 = performance.now();
  r.info.autoReset = true;
  return { msPerFrame: ((t1 - t0) / 60).toFixed(2), calls: r.info.render.calls, tris: r.info.render.triangles, bld: G.city.stats.buildings, pop: G.city.stats.pop, cars: G.view.vehicles.cars.length };
};
