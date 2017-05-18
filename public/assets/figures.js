/*
Configurations and utility functions for figures
*/
if(typeof require != "undefined") {
 // hack for loading from generator
 var d3 = require('./d3.min.js')
 var visualize = require('./visualize.js').visualize
 var tsnejs = require('./tsne.js')
 var demoConfigs = require('./demo-configs.js')
 var distanceMatrix = demoConfigs.distanceMatrix
 var Point = demoConfigs.Point
}

var FIGURES = {
  width: 150,
  height: 150,
  downscaleWidth: 300,
  downscaleHeight: 300,
}

function getPoints(demo, params) {
  if(!params) {
    params = [demo.options[0].start]
    if(demo.options[1]) params.push(demo.options[1].start)
  }
  var points = demo.generator.apply(null, params);
  return points;
}
function renderDemoInitial(demo, params, canvas) {
  visualize(points, canvas, null, null)
}


/*
var demoTimescale = d3.scaleLinear()
  .domain([0, 200, 6000])
  .range([20, 10, 0])
*/
var timescale = d3.scaleLinear()
  .domain([0, 20, 50, 100, 200, 6000])
  .range([60, 30, 20, 10, 0]);

function demoMaker(points, canvas, options, stepCb) {
  var demo = {};
  var paused = false;
  var step = 0;
  var chunk = 1;
  var frameId;

    demo.raw_points = points;

  var tsne = new tsnejs.tSNE(options);
  var dists = distanceMatrix(points);
  tsne.initDataDist(dists);

    canvas.onmousedown = function(ev) {

        abs_scatter(ev, canvas)

        window.onmousemove = function(ev) {
            abs_scatter(ev, canvas);
        }

        window.onmouseup = function() {
            window.onmouseup = null;
            window.onmousemove = null;
            demo.unpause();
        }
            }

function euclidian_dist(v1, v2) {
    return Math.sqrt(
        v1.reduce(function(acc, x, idx) {
            return acc + Math.pow(x - v2[idx], 2);
        }, 0));
}

function nearest(x,y,sc) {
    var cur_idx, cur_dist;
    demo.tsne_pos.forEach(function(pt, idx) {
        var dist = Math.pow(pt[0]*sc-x, 2) + Math.pow(pt[1]*sc-y, 2);
        if(cur_dist === undefined || dist < cur_dist) {
            cur_idx = idx;
            cur_dist = dist;
        }
    })
    return cur_idx;
}

    function abs_scatter(ev, canvas) {
        var bounds = canvas.getBoundingClientRect();

        demo.pause();
        
        var can_sc = canvas.offsetWidth / canvas.getAttribute("width");
        var hit = nearest(ev.clientX - bounds.left, ev.clientY - bounds.top, can_sc);

        // Compute all distances
        var dists = [];
        var tsdists = [];
        demo.tsne_solution
            .forEach(function(_pt, idx) {
                var dist = euclidian_dist(demo.raw_points[hit].coords, demo.raw_points[idx].coords);
                var tsdist = euclidian_dist(demo.tsne_pos[hit], demo.tsne_pos[idx]);

                dists.push(dist);
                tsdists.push(tsdist);
        });

        // Now, we need to figure out a scale that keeps distances relatively consistent
        var mean_dist = dists.reduce(function(acc, x) { return x + acc; }, 0) / dists.length;
        var mean_tsdist = tsdists.reduce(function(acc, x) { return x + acc; }, 0) / tsdists.length;

        //var scale = mean_dist / mean_tsdist;
        var scale = mean_tsdist / mean_dist;

        // re-organize based on distance to the hit point
        var scatter = demo.tsne_solution.map(function(ts_pt, idx) {
            // point should stay on line from the hit

            var dscale = (tsdists[idx] > 0.001 ? dists[idx] / tsdists[idx] : 0) * scale;
            //var dscale = dists[idx] > 0.001 ? (tsdists[idx] / dists[idx]) * scale : 0;
            // var dscale = 1;
            // console.log("idx", idx, "ds", dscale);

            var new_coords = [demo.tsne_pos[hit][0] + dscale * (demo.tsne_pos[idx][0] - demo.tsne_pos[hit][0]),
                              demo.tsne_pos[hit][1] + dscale * (demo.tsne_pos[idx][1] - demo.tsne_pos[hit][1])];

            
            //console.log('scale', scale);//new_coords);
            return new Point(new_coords,
                             ts_pt.color);
        })
        visualize(scatter, canvas, "", undefined, true, hit);
    }
    

  function iterate() {
    if(paused) return;

    // control speed at which we iterate
    if(step >= 200) chunk = 10;
    for(var k = 0; k < chunk; k++) {
      tsne.step();
      ++step;
    }

    //inform the caller about the current step
    stepCb(step)

    // update the solution and render
    var solution = tsne.getSolution().map(function(coords, i) {
      return new Point(coords, points[i].color);
    });
      demo.tsne_solution = solution;
      demo.tsne_pos = visualize(solution, canvas, ""); //removed message

    //control the loop.
    var timeout = timescale(step)
    setTimeout(function() {
      frameId = window.requestAnimationFrame(iterate);
    }, timeout)
  }

  demo.pause = function() {
    if(paused) return; // already paused
    paused = true;
    window.cancelAnimationFrame(frameId)
  }
  demo.unpause = function() {
    if(!paused) return; // already unpaused
    paused = false;
    iterate();
  }
  demo.paused = function() {
    return paused;
  }
  demo.destroy = function() {
    demo.pause();
    delete demo;
  }
  iterate();
  return demo;
}

function runDemoSync(points, canvas, options, stepLimit, no3d) {
  var tsne = new tsnejs.tSNE(options);
  var dists = distanceMatrix(points);
  tsne.initDataDist(dists);
  var step = 0;
  for(var k = 0; k < stepLimit; k++) {
    if(k % 100 === 0) console.log("step", step)
    tsne.step();
    ++step;
  }
  var solution = tsne.getSolution().map(function(coords, i) {
    return new Point(coords, points[i].color);
  });
  visualize(solution, canvas, "", no3d); //removed message
  return step;
}

if(typeof module != "undefined") module.exports = {
  demoMaker: demoMaker,
  runDemoSync: runDemoSync,
  getPoints: getPoints,
  FIGURES: FIGURES
}
