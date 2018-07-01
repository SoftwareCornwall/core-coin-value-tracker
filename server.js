
var defaultPingsPerHour = 4; // 4 pings per hour
var defaultDeviation = 4; // 4% deviation

var debug = true;
var logObjects = false;
var debugLevel = "final";
var debugAllTheThings = false;

/**

starting value
which config (3 / 5) - to add more create a fresh file named config-?
pings per hour (null to use the above default)
deviation (% random fluctuation) (null to use the above default)
**/
var results = getPrices(500, "5", 4);
debugLog(results, "final", "Results");

function debugLog(value, level = 1, title = "", type = "log") {
  if (!debugAllTheThings && level !== debugLevel && level !== "all") return
  // check if the type is either log or error
  if (!["log", "error"].includes(type)) {
    console.error("Invalid type for the debugLog function!");
    return
  }
  if (debug) {
    var line = new Error().stack;
    var lines = line.split("\n");
    if (typeof value == "object") {
      if (logObjects) {
        value = "\n" + JSON.stringify(value, null, 4);
      } else {
        value = ": \n" + JSON.stringify(value, null, "").toString().replace(/,\[/g, ",\n[").replace(/([:,(?!,)])/g, "$1 ").replace(/"/g, "'").replace(/], /g, "],\n") + "\n";
      }
    }
    // console.log(lines)
    var file = lines[2].substring(lines[2].indexOf("/app/") + 5, lines[2].lastIndexOf(")"));
    var exFunction = lines[2].substring(lines[2].indexOf("at") + 3, lines[2].indexOf("(") - 1);
    // console.log(file);
    var titleVal = "";
    if (title != "") titleVal = " ( " + title + " ) ";
    console[type]("[" + file  + " : " + exFunction + titleVal + "] " + value);
  }
}

function trackConfig(day) {
  /*

  This whole section is getting the config and parsing it into a chronological format that is easier to parse.

  It's figuring out the "track" that is the important part, once we know that we can randomize the 4% lee-way.

  */

  debugLog(day, "trackConfig");
  var projection = [];
  var projectionTable = [];
  var blankTracker = 0;
  // For each day in the list...
  for (var i in day) {
    debugLog(day[i].name, "trackConfig");

    // For each item in the track
    for (var j in day[i]["track"]) {
      // Shorthand variable name
      var track = day[i]["track"];
      debugLog(day[i]["name"] + ": " + track[j], "trackConfig");
      projectionTable.push(track[j]);
      // If it's a $, add it to the internal counter.
      if (track[j] == "$") {
        blankTracker += 1;
        debugLog(blankTracker, "trackConfig", "blankTracker");
        continue
      }

      // if the blank tracker is over 0, push the counter to the array and reset the counter.
      // It will only get to this point after it gets over 1. We make sure the very last few $ are added because the very last input (Friday, #7) isn't a $.
      if (blankTracker > 0) {
        projection.push("$" + blankTracker);
        blankTracker = 0;
      }
      debugLog("track[j]: " + track[j], "trackConfig");
      // If the item starts with a # it means it should not have the following pings in that hour counted.
      if (track[j].startsWith("#")) {
        var endItem = track[j].substring(1);
        projection.push(("#" + (100 + parseInt(endItem))).toString());

      // If the config option starts with + or -, add the int to 100 to get the overall percentage.
      } else if (track[j].match(/^(\+|-)/i)) {
        projection.push((100 + parseInt(track[j])).toString());
      } else {
        console.log("Seems to be an issue with the config syntax.");
      }

    }
  }
  return projection;
}

function trackConfigDetailed(projection, settings) {
  var pings = settings.pingsPerHour;
  var projectionDetailed = [];
  var addOn = true;
  // For each item in the simplified track array, we expand the array so that it accounts for the other
  for (var i in projection) {
    i = parseInt(i);
    var item = projection[i];
    // If the item starts with a $...
    // $ means dynamic, as in the track value is calculated for us.
    if (item.startsWith("$")) {
      item = parseInt(item.substring(1));
      var totalPings = (parseInt(item) * pings) + (pings - 1);
      projectionDetailed.push("$" + totalPings);
    } else {
      
      projectionDetailed.push(item);
      
      // If it doesn't start with a $ we need to check if the next item starts with a $ too, so we can add the pings - 1 to this item instead of the next (which would be $)

      // If the next item doesn't also starts with a $...
      if (projection[i+1]) {

        if (!projection[i+1].startsWith("$")) {
          if (!projection[i+1].startsWith("#")) {
            projectionDetailed.push("$3");
          }
        }
      }
    }
  }
  return projectionDetailed
}

function trackDifference(projection) {
  /* Calculating the true difference between entries - we only state the start of the hour in the config. We take 1 away from the multiplier because of the values already set.
     So example:
     500 * * * | 300 * * * | * * * * | * * * * | 200 * * * , where star is a filled in ping, | is splitting up each hour.

     4 * means we've made that hour dynamic ("$"). We fill in the other 3 pings for that hour. It's dynamic so it could be 15 pings per hour and would still work - just means that the increment % would be much smaller.
  */
  // Will hold all of the track projections.
  var dayTrack = [];
  debugLog(projection, "trackDifference");
  for (var i in projection) {
    i = parseInt(i);
    
    var item = projection[i];
    debugLog("projection[i]: " + projection[i], "trackDifference");
    // If the item starts with a $...
    // $ means dynamic, as in the track value is calculated for us.
    if (item.startsWith("$")) {
      item = parseInt(item.substring(1));

      var prevItem = projection[i - 1];
      // Remove the # if the next item starts with one.
      var nextItem = projection[i + 1];
      if (nextItem.startsWith("#")) {
        item += 3;
        nextItem = nextItem.substring(1);
      }

      // Get the difference between the last number and the next.
      var diff = differencefunction(parseInt(prevItem), parseInt(nextItem));

      debugLog("Difference between " +  prevItem + " and " + nextItem + " is: " + diff + ", with " + item + " steps between.", "trackDifference");

      var diffItems = trackPrice(prevItem, nextItem, item);
      debugLog(diffItems, "trackDifference", "diffItems returned");
      for (var k in diffItems) {
        dayTrack.push(diffItems[k]);
      }
    } else {
      if (!item.startsWith("#")) {
        // item = item.substring(1);
        dayTrack.push(parseInt(item));
      } else {
        dayTrack.push(parseInt(item.substring(1)));
      }
    }
  }
  return dayTrack
}

function trackGetRandom(percentageTrack, settings) {
  var percentageValue = [];
  var percentageRandom = [];
  var differenceValue = [];
  var deviation = settings.deviation;
  var startPrice = settings.startPrice;
  
  // For each element, push the values using the number input and % array.
  percentageTrack.forEach(function(element) {
    percentageValue.push(percentageOf(startPrice, element, true));
  });
  percentageValue.forEach(function(element) {
    var rand = randomDeviation(element, startPrice, deviation);
    percentageRandom.push(rand[0]);
    differenceValue.push(rand[1]);
  });
  return [percentageRandom, percentageValue, differenceValue]
}

function trackToDays(track, settings) {
  
  var hoursTest = track.length / settings.dayCount;
  
  debugLog(hoursTest, "trackToDays");
  
  
  if (!(track.length) / settings.dayCount / settings.pingsPerHour == settings.hoursPerDay) {
    debugLog("Looks like there was an error in the matrix! (Number of items don't split up perfectly into " + settings.dayCount + " days.)", "all", "", "error")
    return "Error. See console."
  }
    
  var trackSegmented = new Array(Math.ceil(track.length / hoursTest)).fill().map(_ => track.splice(0, hoursTest));
  var trackObject = {}
  
  for (let i=1; i < trackSegmented.length; i++) {
    trackObject[i] = trackSegmented[i]
  }
  
  return trackObject
}






function differencefunction(a, b) {
  return Math.abs(a - b);
}

function percentageOf(input, percentage, round) {
  var out = (parseInt(input) / 100) * percentage;
  if (round) {
    return Math.floor(out);
  } else {
    return out;
  }
}

// Returns an array of values equal difference, between the start and end values.
function trackPrice(startVal, endVal, runs) {
  startVal = parseInt(startVal);
  endVal = parseInt(endVal);
  runs = parseInt(runs);
  
  // How much we add the track by.
  var addition = differencefunction(startVal, endVal) / runs;
  
  var currentVal = startVal;
  var toReturn = [];
  var count = 1;
  while (count <= runs) {
    var val = 0;
    // making sure we support negative values.
    if (startVal < endVal) {
       val = currentVal + addition;
    } else {
       val = currentVal - addition;
    }
    toReturn.push(parseInt(val));
    currentVal = val;
    count++;
  }
  return toReturn;
}

// base input, track change value, % deviation value
function randomDeviation(input, startVal, deviation) {
  startVal = parseInt(startVal);
  input = parseInt(input);
  
  // x% of the starting value
  // (gets the fixed deviation % to determine the max 
  var percent = (parseInt(startVal) / 100) * deviation;
  
  
  var random = Math.floor(Math.random() * percent);
  var upOrDown = Math.floor(Math.random() * 2);
  
  // randomly adds or take away the determined value.
  var out;
  if (upOrDown == 1) {
    out = input + random;
  } else if (upOrDown == 0) {
    out = input - random;
    random = parseInt("-" + random);
  } else {
    debugLog("Should never get here. upOrDown should only be 0 or 1.", "all", "error");
  }
  
  // the final value taking the original starting input and adding/subtracting the track value (incl random) with it., what the (total)random change was (incl -).
  return [Math.floor(out), random];
}

function getPrices(startPrice=500, configToUse = "1", pingsPerHour = defaultPingsPerHour, deviation = defaultDeviation) {

  var settings = {};
  settings.config = require("./config-" + configToUse + ".js");
  settings.days = settings.config.days;
  settings.dayCount = settings.config.days.length;
  settings.pingsPerHour = pingsPerHour;
  
  // last part gets the number of hours in a day
  settings.hoursPerDay = Object.keys(settings.days[0].track).length;
  
  // % deviation of the determined value in the track.
  settings.deviation = deviation;
  settings.startPrice = startPrice;



  console.error("===== Ran " + Date() + " =====");
  debugLog(settings, 1);



  startPrice = parseInt(startPrice);
  // var newPrice = randomDeviation(startPrice);

  var projection = trackConfig(settings.days);
  var projectionDetailed = trackConfigDetailed(projection, settings);
  var dayTrack = trackDifference(projectionDetailed);
  var randomTrack = trackGetRandom(dayTrack, settings);
  
  var trackRandom = randomTrack[0];
  var trackPercentageValue = randomTrack[1];
  var trackRandomDifferences = randomTrack[2];
  
  var trackDays = trackToDays(trackRandom, settings);
  
  debugLog(projection, "resultsDebug", "projection");
  debugLog(projectionDetailed, "resultsDebug", "projectionDetailed");
  debugLog(dayTrack, "resultsDebug", "dayTrack");
  debugLog(trackRandom, "resultsDebug", "trackRandom");
  debugLog(trackPercentageValue, "resultsDebug", "trackPercentageValue");
  debugLog(trackRandomDifferences, "resultsDebug", "trackRandomDifferences");
  debugLog(trackDays, "resultsDebug", "trackDays");
  
  
  return trackDays
}