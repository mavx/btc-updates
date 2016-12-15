function Parse_ETH_Data() {
  var response = UrlFetchApp.fetch("https://etherchain.org/api/statistics/price");
  var data = response.getContentText();
  //var data = JSON.stringify(json);
  
  var myRegex = /:\d{1,3}\.\d{1,2}\}|:\d{1,3}\}/g // extracts price in :XX.XX} or :XX} format
  var myRegex2 = /\d{1,3}\.\d{1,2}|\d{1,3}/g // returns price in XX.XX or XX format
  var timeRegex = /\d{1,4}-\d{1,2}-\d{1,2}T\d{1,2}:\d{1,2}:\d{1,2}/g // extracts timestamp
  
  // Extract price to array
  var search_match = data.match(myRegex).toString();
  var refine_match = search_match.match(myRegex2).toString();
  var price_array = refine_match.split(",");
  var price_length = price_array.length;
  for (var i=0; i<price_length; i++) { price_array[i] = Number(price_array[i], 10) } 
  
  // Extract timestamp to array
  var time_extract = data.match(timeRegex).toString();
  var time_array = time_extract.split(",");
  //var time_length = time_array.length;

  //Browser.msgBox("Your price array has " + str_length + " values and " + char_length + " characters.");
  
  // Create array of prices with timestamp
  var price_trend = [[]];
  for (var t=0; t<price_length; t++) {
    price_trend[t] = [time_array[t], price_array[t]]
  }
  
  // Write array to spreadsheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ETH_Trend");
  var range = sheet.getRange(2, 1, price_length, 2)
  range.setValues(price_trend); // adds price to every row
  
  Browser.msgBox("Latest price is USD" + price_trend[t-1][1] + " at " + price_trend[t-1][0]);
  //Browser.msgBox(price_trend);
}
