/* Semantic illustration layers. All coordinates refer to the original asset canvas.
   These are visual learning themes, not physical assembly or fabrication instructions. */
(function () {
  'use strict';
  var size = 1254;
  function svg(body, width, height) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + (width || size) + '" height="' + (height || size) + '" viewBox="0 0 ' + (width || size) + ' ' + (height || size) + '">' + body + '</svg>');
  }
  function mask(show, hide) {
    return svg('<defs><mask id="shape" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" mask-type="luminance"><rect width="1254" height="1254" fill="black"/><g fill="white">' + show + '</g><g fill="black">' + (hide || '') + '</g></mask></defs><rect width="1254" height="1254" fill="white" mask="url(#shape)"/>');
  }
  function circle(atom, fill) {
    return '<circle cx="' + atom[0] + '" cy="' + atom[1] + '" r="' + atom[2] + '"' + (fill ? ' fill="' + fill + '"' : '') + '/>';
  }
  function polygon(points) { return '<polygon points="' + points + '"/>'; }
  var all = '<rect width="1254" height="1254"/>';
  var lattice = 'assets/study/silicon-diamond-network.svg';
  // Diamond-cubic: keep all 18 sites of the primary conventional cell, then add
  // their real nearest neighbors across cell boundaries. Every primary site
  // now has its four tetrahedral bonds; the finite outer shell is context.
  var siliconSites = [[0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1],[0.5,0.5,0],[0.5,0.5,1],[0.5,0,0.5],[0.5,1,0.5],[0,0.5,0.5],[1,0.5,0.5],[0.25,0.25,0.25],[0.25,0.75,0.75],[0.75,0.25,0.75],[0.75,0.75,0.25]];
  var primaryCount = siliconSites.length;
  var siteIndex = new Map(siliconSites.map(function (site,index) { return [site.join(','),index]; }));
  var nearestOffsets = [[.25,.25,.25],[.25,-.25,-.25],[-.25,.25,-.25],[-.25,-.25,.25]];
  for (var siteId=0; siteId<primaryCount; siteId++) {
    var site=siliconSites[siteId], sign=Math.round(site[0]*4)%2===0?1:-1;
    nearestOffsets.forEach(function (offset) {
      var neighbor=site.map(function (value,axis) { return value+sign*offset[axis]; });
      var key=neighbor.join(',');
      if (!siteIndex.has(key)) { siteIndex.set(key,siliconSites.length); siliconSites.push(neighbor); }
    });
  }
  var siliconBonds=[];
  for (var i=0; i<siliconSites.length; i++) for (var j=i+1; j<siliconSites.length; j++) {
    var distance2=siliconSites[i].reduce(function (sum,value,axis) { return sum+(value-siliconSites[j][axis])*(value-siliconSites[j][axis]); },0);
    if (distance2===3/16) siliconBonds.push([i,j]);
  }
  // Fit the entire neighbor shell. This camera separates projected atom centers
  // so the new boundary bonds can actually be read rather than hidden by spheres.
  var az=.51, elevation=.31;
  var projected=siliconSites.map(function (site) {
    var x=site[0]-.5,y=site[1]-.5,z=site[2]-.5;
    return {x:Math.cos(az)*x-Math.sin(az)*z,y:-Math.sin(az)*Math.sin(elevation)*x+Math.cos(elevation)*y-Math.cos(az)*Math.sin(elevation)*z};
  });
  var minX=Math.min.apply(Math,projected.map(function (p) { return p.x; }));
  var maxX=Math.max.apply(Math,projected.map(function (p) { return p.x; }));
  var minY=Math.min.apply(Math,projected.map(function (p) { return p.y; }));
  var maxY=Math.max.apply(Math,projected.map(function (p) { return p.y; }));
  var fit=1100/Math.max(maxX-minX,maxY-minY);
  var atoms=projected.map(function (p,index) { return [+(size/2+(p.x-(minX+maxX)/2)*fit).toFixed(2),+(size/2-(p.y-(minY+maxY)/2)*fit).toFixed(2),index<primaryCount?32:24]; });
  // Complete vector objects replace raster crops: no borrowed rod fragments on a
  // moving sphere and no concave holes where a neighbor used to occlude a bond.
  var sphereDefs = '<defs><radialGradient id="silicon-sphere" cx=".29" cy=".23" r=".85"><stop stop-color="#d5e7f3"/><stop offset=".24" stop-color="#97b6cd"/><stop offset=".58" stop-color="#6587a3"/><stop offset=".84" stop-color="#3d5c76"/><stop offset="1" stop-color="#29455e"/></radialGradient><radialGradient id="silicon-neighbor" cx=".29" cy=".23" r=".85"><stop stop-color="#edf4f9"/><stop offset=".3" stop-color="#cadbe7"/><stop offset=".7" stop-color="#afc4d4"/><stop offset="1" stop-color="#8da7bb"/></radialGradient></defs>';
  var frame = '';
  for (var a=0; a<8; a++) for (var b=a+1; b<8; b++) {
    var edge = siliconSites[a].reduce(function (sum,value,axis) { return sum+Math.abs(value-siliconSites[b][axis]); },0);
    if (edge===1) frame += '<line x1="'+atoms[a][0]+'" y1="'+atoms[a][1]+'" x2="'+atoms[b][0]+'" y2="'+atoms[b][1]+'" stroke="#8198ad" stroke-width="1.7" stroke-dasharray="5 8" opacity=".38"/>';
  }
  var materialLayers = [{ id:'cell-boundary', src:svg(frame), start:.15, end:.34, opacityStart:.15, opacityEnd:.34, z:0 }];
  var atomStart = atoms.map(function (_,index) { return .006+index/(atoms.length-1)*.15; });
  var atomEnd = atomStart.map(function (start) { return start+.15; });
  siliconBonds.forEach(function (bond,index) {
    var a=atoms[bond[0]], b=atoms[bond[1]], gradient='silicon-bond-'+index;
    var dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length*8.5,ny=dx/length*8.5;
    var defs='<defs><linearGradient id="'+gradient+'" gradientUnits="userSpaceOnUse" x1="'+(a[0]+nx)+'" y1="'+(a[1]+ny)+'" x2="'+(a[0]-nx)+'" y2="'+(a[1]-ny)+'"><stop stop-color="#4b6a83"/><stop offset=".34" stop-color="#91aabd"/><stop offset=".55" stop-color="#cfdee8"/><stop offset=".76" stop-color="#a2bacb"/><stop offset="1" stop-color="#57768e"/></linearGradient></defs>';
    var context=bond[0]>=primaryCount||bond[1]>=primaryCount;
    var line='<line data-bond="'+index+'" x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="url(#'+gradient+')" stroke-width="'+(context?13:17)+'" stroke-linecap="round"'+(context?' opacity=".64"':'')+'/>';
    var start=Math.max(atomEnd[bond[0]],atomEnd[bond[1]])+.002;
    // Both complete spheres settle first. The connecting rod then fades in at
    // its final position, so a pause never leaves a severed or floating joint.
    materialLayers.push({ id:'bond-'+(index+1), src:svg(defs+line), fromX:0, fromY:0, start:start, end:start+.055, opacityStart:start, opacityEnd:start+.055, z:1 });
  });
  atoms.forEach(function (atom,index) {
    var start=atomStart[index];
    var directionX=index%2?1:-1, directionY=index%3-1;
    var x=directionX*Math.min(150,directionX>0?size-76-atom[0]:atom[0]-76);
    var y=directionY*Math.min(125,directionY>0?size-76-atom[1]:atom[1]-76);
    // Keep each whole sphere inside the illustration canvas throughout entry.
    var body='<circle data-atom="'+index+'" data-cell="'+(index<primaryCount?'primary':'neighbor')+'" cx="'+atom[0]+'" cy="'+atom[1]+'" r="'+atom[2]+'" fill="url(#'+(index<primaryCount?'silicon-sphere':'silicon-neighbor')+')"/>';
    materialLayers.push({ id:'atom-'+(index+1), src:svg(sphereDefs+body), fromX:x/size*100, fromY:y/size*100, start:start, end:atomEnd[index], opacityStart:start, opacityEnd:start+.065, z:10+index });
  });

  // Lens-based UV/DUV projection illustration. EUV uses mirrors, not this lens.
  // Moving parts are explanatory visual layers, not an equipment assembly sequence.
  var process = 'assets/study/photolithography.webp';
  var reticle = '<path d="M358 292 L879 292 L986 512 L251 512Z"/>';
  var lens = '<ellipse cx="620" cy="718" rx="328" ry="120"/>';
  var wafer = '<ellipse cx="621" cy="1093" rx="365" ry="149"/>';
  var processLayers = [
    { id:'reticle-mask', src:process, mask:mask(reticle), fromY:-6, start:0, end:.14, opacityStart:0, opacityEnd:.06, z:2 },
    { id:'projection-lens', src:process, mask:mask(lens), fromY:-4, start:.025, end:.17, opacityStart:.025, opacityEnd:.09, z:3 },
    { id:'silicon-wafer', src:process, mask:mask(wafer), fromX:-12, fromY:9, start:.05, end:.40, opacityStart:.05, opacityEnd:.12, z:4 },
    { id:'patterned-light', src:process, mask:mask(all,reticle+lens+wafer), fromX:0, fromY:0, start:.18, end:.44, opacityStart:.18, opacityEnd:.44, z:1 }
  ];

  var device = 'assets/study/devices-cutout.webp';
  var cap = polygon('100,438 612,181 1154,429 1154,475 630,744 100,491');
  var silicon = polygon('178,580 628,349 1077,578 1077,615 630,851 178,613');
  var film = polygon('168,649 628,416 1078,647 1078,696 630,917 168,692');
  // Complete surfaces under the original visible textures fill faces hidden by
  // upper layers in the flat reference, so moving layers do not reveal holes.
  function surface(top, front, left, colors) {
    return svg('<defs><linearGradient id="face" x2="1" y2="1"><stop stop-color="' + colors[0] + '"/><stop offset="1" stop-color="' + colors[1] + '"/></linearGradient></defs><polygon points="' + top + '" fill="url(#face)" stroke="' + colors[2] + '" stroke-width="2"/><polygon points="' + front + '" fill="' + colors[1] + '"/><polygon points="' + left + '" fill="' + colors[2] + '"/>');
  }
  var baseSurface = surface('92,759 633,488 1161,752 635,1024', '92,759 635,1024 635,1086 92,822', '635,1024 1161,752 1161,814 635,1086', ['#9abbb0','#66877c','#a6b7b6']);
  var filmSurface = surface('168,649 628,416 1078,647 630,878', '168,649 630,878 630,917 168,692', '630,878 1078,647 1078,696 630,917', ['#c3f6e7','#86cfc1','#a4e8db']);
  var siliconSurface = surface('178,580 628,349 1077,578 630,813', '178,580 630,813 630,851 178,613', '630,813 1077,578 1077,615 630,851', ['#354d65','#172c43','#233e56']);
  var deviceLayers = [];
  function devicePart(id, underlay, visibleMask, start, end, fromY, z) {
    if (underlay) deviceLayers.push({ id: id + '-surface', src: underlay, fromX: 0, fromY: fromY, start: start, end: end, opacityStart: start, opacityEnd: start + .045, z: z });
    deviceLayers.push({ id: id, src: device, mask: visibleMask, fromX: 0, fromY: fromY, start: start, end: end, opacityStart: start, opacityEnd: start + .045, z: z + 1 });
  }
  devicePart('substrate', baseSurface, mask(all, cap + silicon + film), .005, .17, -30, 0);
  devicePart('thin-film', filmSurface, mask(film, cap + silicon), .09, .29, -42, 10);
  devicePart('silicon', siliconSurface, mask(silicon, cap), .18, .39, -54, 20);
  devicePart('lid', null, mask(cap), .27, .49, -66, 30);

  var euv = 'assets/study/industry-euv.webp';
  var industryLayers = [
    { id: 'equipment', src: euv, fromX: 0, fromY: 0, start: 0, end: .28, opacityStart: 0, opacityEnd: .16, z: 0 }
  ];
  window.HISEM_STUDY_LAYERS = {
    materials: { width: size, height: size, baseSrc: lattice, geometry: { sites: siliconSites, bonds: siliconBonds, primaryCount: primaryCount }, completeAt: .39, layers: materialLayers },
    process: { width: size, height: size, baseSrc: process, completeAt: .46, layers: processLayers },
    devices: { width: size, height: size, baseSrc: device, completeAt: .50, layers: deviceLayers },
    industry: { width: 1774, height: 887, baseSrc: euv, completeAt: .30, layers: industryLayers }
  };
})();
