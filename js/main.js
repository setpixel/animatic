/*

Information on screen
Ability to hide info
Load scene order 
Alerts for missing scenes and timings
Drag and drop path
Output video
Record audio

*/

'use strict';

var fs = require('fs'),
  path = require('path');

var currentPosition = [0,0]
var sceneData = [];
var notesData = [];
var recordMode = false;
var recordTimestamp;
var recordData;
var playbackData = [];
var playbackMode = false;
var frameTimer;

fs.watch('./', {recursive: true}, function() {
  if (location){
    location.reload();
  }
});

var gui = require('nw.gui');
if (process.platform === "darwin") {
  var mb = new gui.Menu({type: 'menubar'});
  mb.createMacBuiltin('Animatic', {
    hideEdit: false,
  });
  gui.Window.get().menu = mb;
};

onload = function() {
  gui.Window.get().show();
  gui.Window.get().moveTo(600,0);
  var devtool = gui.Window.get().showDevTools();
  devtool.moveTo(600,700);
  searchDirectories();
  
  window.addEventListener('dragover', function(e){
    e.preventDefault();
    e.stopPropagation();
  }, false);
  window.addEventListener('drop', function(e){
    e.preventDefault();
    e.stopPropagation();
    localStorage.path = e.dataTransfer.files[0].path;
    searchDirectories(e.dataTransfer.files[0].path);
  }, false);


  $('textarea').keydown(function(e) {
    e.stopPropagation();
  });

  $('#general-notes')[0].addEventListener('input', function() {
    updateGeneralNote($('#general-notes').val());
  }, false);

  $('#frame-notes')[0].addEventListener('input', function() {
    updateFrameNote($('#frame-notes').val());
  }, false);

};

var updateGeneralNote = function(value) {
  notesData[currentPosition[0]][0] = value;
  saveNoteToDisk(currentPosition[0]);
}

var updateFrameNote = function(value) {
  notesData[currentPosition[0]][1][currentPosition[1]] = value
  saveNoteToDisk(currentPosition[0]);
}

var saveNoteToDisk = function(sceneNum) {
  var str = '';
  str = JSON.stringify(notesData[sceneNum]);
  fs.writeFile(sceneData[sceneNum][0] + "/notes.json", str);
  saveNoteSummary();
}

var saveNoteSummary = function() {
  var str = '';

  for (var i = 0; i < notesData.length; i++) {
    var sceneName = sceneData[i][0].split("/")
    sceneName = sceneName[sceneName.length-1]

    var anyNotes = false;
    for (var i3 = 0; i3 < notesData[i][1].length; i3++) {
      if (notesData[i][1][i3]) {
        anyNotes = true;
      }
    }

    if (notesData[i][0] || anyNotes) {
      str += "-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n";
      str += "SCENE " + (i+1) + ": " + sceneName;
      str += "\n";
      str += "-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n";
      str += "\n";
    }

    if (notesData[i][0]) {
      str += notesData[i][0];
      str += "\n\n";
    }

    for (var i2 = 0; i2 < notesData[i][1].length; i2++) {
      if (notesData[i][1][i2]) {
        str += "---------------------------------------\n";
        str += "FRAME " + (i+1) + "." + (i2+1) + ": " + sceneData[i][1][i2];
        str += "\n";
        str += "---------------------------------------\n";
        str += "\n";
        str += notesData[i][1][i2];
        str += "\n\n";
      }
    }
  }
  fs.writeFile(localStorage.path + "/notesummary.txt", str)
};

var searchDirectories = function(specialpath) {
  sceneData = [];
  currentPosition = [0,0];

  if (specialpath) {
    var pathString = specialpath;
  } else {
    var pathString = localStorage.path;
  }
  if (pathString) {
    var file = pathString + "/scenes.txt";
    var obj;
    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        // no scenes.txt, just load in order
        var dirList = fs.readdirSync(pathString).map(function (file) {
          return path.join(pathString, file);
        }).filter(function(file){
          return fs.statSync(file).isDirectory();
        });

        for (var i = 0; i < dirList.length; i++) {
          sceneData.push([dirList[i], getSequentialImages(dirList[i])])
          getPlaybackData(dirList[i], sceneData.length-1);
          getNotesData(dirList[i], sceneData.length-1);
        }
        updateFrame();
      } else {
        var folders = data.split("\n");
        for (var i = 0; i < folders.length; i++) {
          var file = pathString + "/" + folders[i];
          sceneData.push([file, getSequentialImages(file)])
          getPlaybackData(file, sceneData.length-1);
          getNotesData(file, sceneData.length-1);
        }
        updateFrame();
        setTimeout(updateFrame, 500);
      }
    });
  }
};

var getSequentialImages = function(pathString) {
  var imageList;
  imageList = fs.readdirSync(pathString).filter(function(file){
    return ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.gif'].indexOf(path.extname(file)) > -1
  });
  return imageList;
};

var getPlaybackData = function(pathString, position) {
  var file = pathString + "/timing.json";
  var obj;
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      // console.log("NO TIMING HERE WILL APPROX")
    } else {
      playbackData[position] = JSON.parse(data);
    }
  });
};

var getNotesData = function(pathString, position) {
  var file = pathString + "/notes.json";
  var obj;
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      notesData[position] = [undefined,[]];
    } else {
      notesData[position] = JSON.parse(data);
    }
  });
};

var advanceFrame = function(frameDir){
  switch (frameDir) {
    case 1:
      if (currentPosition[1] == (sceneData[currentPosition[0]][1].length-1)) {
        if (recordMode == true) {
          recordData.push(new Date().getTime()-recordTimestamp);
          finishRecording();
        }

        if (currentPosition[0] == sceneData.length -1) {
          // do nothing youre at the end
        } else {
          currentPosition[0] += 1;
          currentPosition[1] = 0;
        }
      } else {
        currentPosition[1] += 1;
        if (recordMode == true) {
          if (recordData.length == 0) {
            recordData.push(new Date().getTime()-recordTimestamp);
            recordTimestamp = new Date().getTime();
          } else {
            recordData.push(new Date().getTime()-recordTimestamp);
            recordTimestamp = new Date().getTime();
          }
        }
      }
      break;
    case -1:
      recordMode = false;
      if (currentPosition[1] == 0) {
        if (currentPosition[0] == 0) {
          // do nothing youre at the beginning
        } else {
          currentPosition[0] -= 1;
          currentPosition[1] = (sceneData[currentPosition[0]][1].length-1);
        }
      } else {
        currentPosition[1] -= 1;
      }
      break;
  }
  updateFrame();
};

var advanceScene = function(frameDir){
  recordMode = false;
  switch (frameDir) {
    case 1:
      if (currentPosition[0] == sceneData.length -1) {
        // do nothing youre at the end
        if (currentPosition[1] !== sceneData[currentPosition[0]][1].length-1) {
          currentPosition[1] = sceneData[currentPosition[0]][1].length-1
        }
      } else {
        currentPosition[0] += 1;
        currentPosition[1] = 0;
      }
      break;
    case -1:
      if (currentPosition[1] !== 0) {
        currentPosition[1] = 0;
      } else {
        if (currentPosition[0] == 0) {
          // do nothing youre at the beginning
        } else {
          currentPosition[0] -= 1;
          currentPosition[1] = 0;
        }
      }
      break;
  }
  updateFrame();
};

var updateFrame = function() {
  var imagePath = sceneData[currentPosition[0]][0];
  var imageFile = sceneData[currentPosition[0]][1][currentPosition[1]];
  $("#main-image").attr('src', imagePath + '/' + imageFile)
  updateNotes();
  updateInfo();
};


var updateNotes = function() {
  if (notesData[currentPosition[0]]) {
  if (notesData[currentPosition[0]][0]) {
    $('#general-notes').val(notesData[currentPosition[0]][0])
  } else {
    $('#general-notes').val('');
  }
  if (notesData[currentPosition[0]][1][currentPosition[1]]) {
    $('#frame-notes').val(notesData[currentPosition[0]][1][currentPosition[1]])
  } else {
    $('#frame-notes').val('');
  }    
  }

}

var updateInfo = function(){
  var currentBoard = 1;
  for (var i = 0; i < currentPosition[0]; i++) {
    currentBoard += sceneData[i][1].length;
  }
  currentBoard += currentPosition[1];

  var totalBoards = 0;
  for (var i = 0; i < sceneData.length; i++) {
    totalBoards += sceneData[i][1].length
  }

  var sceneName = sceneData[currentPosition[0]][0].split("/")
  sceneName = sceneName[sceneName.length-1]

  var currentTime = 0;
  var totalTime = 0;

  var currentSceneTime = 0;
  var totalSceneTime = 0;

  for (var i = 0; i < sceneData.length; i++) {
    for (var i2 = 0; i2 < sceneData[i][1].length; i2++) {
      if (playbackData[i]) {
        if (i == currentPosition[0]) {
          totalSceneTime += playbackData[i][i2] || 1000;
        }
        totalTime += playbackData[i][i2] || 1000;
      } else {
        if (i == currentPosition[0]) {
          totalSceneTime += 1000;
        }
        totalTime += 1000;
      }
      if ((i == currentPosition[0]) && (i2 == currentPosition[1])) {
        currentTime = totalTime;
        currentSceneTime = totalSceneTime;
      }
     }
  }

  var html = [];
  html.push('<div class="scene-name">' + (currentPosition[0]+1) + '. ' +  sceneName + ' - ' + sceneData[currentPosition[0]][1][currentPosition[1]] + '</div>');
  html.push('<div class="scene-timing">' + msToTime(currentSceneTime) + ' / ' + msToTime(totalSceneTime) + ' [' + msToTime(currentTime) + ' / ' + msToTime(totalTime) + ']</div>');
  $('#name-info').html(html.join(''));

  var html = [];
  html.push('<div class="row"><div class="row-label">SCENE:</div><div class="row-current">' + (currentPosition[0]+1) + '</div><div class="pill-container"><div class="pill-value" style="width: ' + Math.round(((currentPosition[0])/(sceneData.length-1))*100) + '%;"></div></div><div class="row-total">' + sceneData.length + '</div></div>');
  html.push('<div class="row"><div class="row-label">FRAME:</div><div class="row-current">' + (currentPosition[1]+1) + '</div><div class="pill-container"><div class="pill-value" style="width: ' + Math.round(((currentPosition[1])/(sceneData[currentPosition[0]][1].length-1))*100) + '%;"></div></div><div class="row-total">' + sceneData[currentPosition[0]][1].length + '</div></div>');
  html.push('<div class="row"><div class="row-label">BOARD:</div><div class="row-current">' + currentBoard + '</div><div class="pill-container"><div class="pill-value" style="width: ' + Math.round(((currentBoard-1)/(totalBoards-1))*100) + '%;"></div></div><div class="row-total">' + totalBoards + '</div></div>');

  $('#number-info').html(html.join(''));
};

var recordScene = function() {
  currentPosition[1] = 0;
  updateFrame();
  recordMode = true;
  recordTimestamp = new Date().getTime();
  recordData = [];
};

var finishRecording = function() {
  // console.log("DONE RECORDING SCENE!");
  recordMode = false;
  playbackData[currentPosition[0]] = recordData;
  var str = ''
  str = JSON.stringify(recordData)
  fs.writeFile(sceneData[currentPosition[0]][0] + "/timing.json", str)
};

var togglePlayback = function() {
  playbackMode = !playbackMode;
  if (playbackMode) {
    // begin playing
    if (playbackData[currentPosition[0]]) {
      frameTimer = setTimeout(playAdvance, playbackData[currentPosition[0]][currentPosition[1]])
    } else {
      frameTimer = setTimeout(playAdvance, 1000)
    }
  } else {
    // stop playing
    clearTimeout(frameTimer);
  }
};

var playAdvance = function() {
  if ((currentPosition[1] == (sceneData[currentPosition[0]][1].length-1)) && (currentPosition[0] == sceneData.length -1)) {
    playbackMode = false;
  } else {
    advanceFrame(1);
    if (playbackData[currentPosition[0]]) {
      frameTimer = setTimeout(playAdvance, playbackData[currentPosition[0]][currentPosition[1]])
    } else {
      frameTimer = setTimeout(playAdvance, 1000)
    }
  }
};

var advanceNote = function() {
  for (var i = currentPosition[0]; i < sceneData.length; i++) {
    var shouldBreak = false;
    if (i == currentPosition[0]) {
      var i2 = currentPosition[1]+1;
    } else {
      var i2 = 0;
      //console.log("sup")
      if (notesData[i][0]) {
        // console.log("NOTE HERE!!!");
        // console.log(notesData[i][0])
        currentPosition = [i, i2];
        updateFrame();
        break;
      }
    }
    for (i2; i2 < sceneData[i][1].length; i2++) {
      if (notesData[i][1][i2]) {
        // console.log("NOTE HERE");
        // console.log(notesData[i][1][i2])
        currentPosition = [i, i2];
        updateFrame();
        shouldBreak = true;
        break;
      }
    }
    if (shouldBreak) { break; };
  }
};

var previousNote = function() {
  for (var i = currentPosition[0]; i > -1; i--) {
    var shouldBreak = false;
    if (i == currentPosition[0]) {
      var i2 = currentPosition[1]-1;
      // if (notesData[i][0]) {
      //   // console.log("NOTE HERE!!!");
      //   // console.log(notesData[i][0])
      //   currentPosition = [i, i2];
      //   updateFrame();
      //   break;
      // }
    } else {
      var i2 = sceneData[i][1].length-1;
      // console.log("sup")
    }
    for (i2; i2 > -1; i2--) {
      if (notesData[i][1][i2]) {
        // console.log("NOTE HERE");
        // console.log(notesData[i][1][i2])
        currentPosition = [i, i2];
        updateFrame();
        shouldBreak = true;
        break;
      }

      if (notesData[i][0] && (i2 == 0)) {
         console.log("NOTE HERE!!!");
        // console.log(notesData[i][0])
        currentPosition = [i, i2];
        updateFrame();
        shouldBreak = true;
        break;
      }



    }
    if (shouldBreak) { break; };
  }
};

window.onkeydown = function(key){
  // console.log(key);
  switch (key.keyCode) {
    // back arrow
    case 37:
      clearTimeout(frameTimer);
      playbackMode = false;
      if (key.metaKey) {
        advanceScene(-1);
      } else {
        advanceFrame(-1);
      }
      break;
    // front arrow
    case 39:
      clearTimeout(frameTimer);
      playbackMode = false;
      if (key.metaKey) {
        advanceScene(1);
      } else {
        advanceFrame(1);
      }
      break;
    // r key
    case 82:
      if (key.metaKey){
        recordScene();
      }
      break;
    // space key
    case 32: 
      togglePlayback();
      break;
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      var position;
      if (key.keyCode == 48) {
        position = 9;
      } else {
        position = key.keyCode-49;
      }
      var percentage = position/9;
      currentPosition[0] = Math.round((sceneData.length-1)*percentage);
      currentPosition[1] = 0;
      updateFrame();
      break;
    case 72:
      $("#content").toggleClass("show")
      break;
    case 188:
      clearTimeout(frameTimer);
      playbackMode = false;
      previousNote();
      break;
    case 190:
      clearTimeout(frameTimer);
      playbackMode = false;
      advanceNote();
      break;
  }
};

function msToTime(s) {
  function addZ(n) {
    return (n<10? '0':'') + n;
  }
  var ms = (s % 1000);
  s = (s - ms) / 1000;
  var secs = s % 60;
  s = (s - secs) / 60;
  var mins = s % 60;
  var hrs = (s - mins) / 60;
  if (hrs) {
    return hrs + ':' + addZ(mins) + ':' + addZ(secs);
  } else {
    return mins + ':' + addZ(secs); //+ '.' + ms.toString().substring(0,1);
  }
};