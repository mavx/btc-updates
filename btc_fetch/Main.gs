// Activate to "true" when testing, will have following impacts:
// ==> emailAddress set to email1@gmail.com
// ==> email criteria always set to run
// ==> appendRow is turned off for both Historic and 3DayData
var debug = false

// Define global variables
var ss = SpreadsheetApp.getActiveSpreadsheet()
var historic_data = ss.getSheetByName("Historic")
var three_day_data = ss.getSheetByName("3DayData")
var one_day_data = ss.getSheetByName("1DayData")
var dashboard = ss.getSheetByName("Dashboard")
var source = ss.getSheetByName("Sources")

// API Endpoints
var BITX_API = "https://api.mybitx.com/api/1/ticker?pair=XBTMYR"
var BITAV_API = "https://apiv2.bitcoinaverage.com/indices/global/ticker/BTCUSD"
var COINDESK_API = "https://api.coindesk.com/v1/bpi/currentprice/MYR.json"
var POLONIEX_API = "https://poloniex.com/public?command=returnTicker"

// Main function to run
function main() {
  BTC_realtimedata()
}

// Let's define a function to make writing values to cells easier...
function writeToCell(sheet, CellRange, WriteValue) {
  sheet.getRange(CellRange).setValue(WriteValue);
}

// Return JSON response from a URL
function getJson(url) {
  var data = UrlFetchApp.fetch(url).getContentText()
  return JSON.parse(data)
}

function extractPrice(json, priceType) {
  if (priceType == "bitx_bid") {
    return parseFloat(json["bid"])
  } else if (priceType == "bitx_ask") {
    return parseFloat(json["ask"])
  } else if (priceType == "bitav_bid") {
    return parseFloat(json["bid"])
  } else if (priceType == "bitav_ask") {
    return parseFloat(json["ask"])
  } else if (priceType == "coindesk") {
    return parseFloat(json["bpi"]["USD"]["rate_float"])
  } else if (priceType == "poloniex") {
    return parseFloat(json["USDT_BTC"]["lowestAsk"])
  } else {
    return 0.0
  }
}

//Calculate average of last 3 value changes
function average_change(row, col, numrow, numcol) {
  var change_array = historic_data.getRange(row, col, numrow, numcol).getValues()[0] // returns column array
  var change_total = 0
  for (var i = 0; i < change_array.length; i ++) {
    change_total += change_array[i]
  }
  var avg_change = Math.round(change_total/change_array.length*100)/100
  return avg_change
}

//###################################### BEGIN MAIN FUNCTION #############################################

function BTC_realtimedata() {
  // Define destination sheet, last row & col BEFORE append
  var lastrow = historic_data.getLastRow()
  var lastcol = historic_data.getLastColumn()
  
  // Query the BTC market data API
  var BitX = getJson(BITX_API)
  var BitAv = getJson(BITAV_API)
  var CoinDesk = getJson(COINDESK_API)
  var polo = getJson(POLONIEX_API)

  writeToCell(source, 'B2', BitX);
  writeToCell(source, 'B3', BitAv);
  writeToCell(source, 'B4', CoinDesk);
  writeToCell(source, 'B5', polo);

  // Add timestamp
  var timestamp = new Date()
  var formattedDate = Utilities.formatDate(timestamp, "GMT+08:00", "EEE, d-MMM-yy");
  var formattedTime = Utilities.formatDate(timestamp, "GMT+08:00", "HH:mm");
  writeToCell(dashboard, 'B1', formattedDate);
  writeToCell(dashboard, 'C1', formattedTime);
  
  // Get previous and new USD exchange rate
  var prev_usdMYR = parseFloat(historic_data.getRange(lastrow, 12, 1, 1).getValue()) // Stores previous usdMYR value
  var usdMYR = parseFloat(dashboard.getRange("B2").getValue()) //Use existing GoogleFinance USDMYR rate
  
  // Extract then store bid and ask prices in MYR
  var gfBTC = parseFloat(dashboard.getRange("B5").getValue()) * usdMYR //Use existing GoogleFinance USDMYR rate
  var bxBid = extractPrice(BitX, "bitx_bid")
  var bxAsk = extractPrice(BitX, "bitx_ask")
  var baBid = extractPrice(BitAv, "bitav_bid") * usdMYR
  var baAsk = extractPrice(BitAv, "bitav_ask") * usdMYR
  var cd = extractPrice(CoinDesk, "coindesk") * usdMYR
  var poloAsk = extractPrice(polo, "poloniex") * usdMYR
  
  writeToCell(dashboard, 'F5', poloAsk/usdMYR);
  writeToCell(dashboard, 'F6', poloAsk);
  
  // Calculate % price movement on BitAv
  var avg = parseFloat(historic_data.getRange(lastrow, 3, 1, 1).getValue()) // Stores previous BitAv value
  var avg2 = baAsk // Stores new BitAv value
  var perc_change = ((avg2/usdMYR)/(avg/prev_usdMYR) - 1)*100 // calculate % change using actual USD value
  
  // Calculate % price movement on BitX
  var bitx_current = historic_data.getRange(lastrow, 4, 1, 1).getValue() // Gets current Bitx value
  var bitx_change = (bxAsk/bitx_current - 1)*100
  
  // Calculate % price movement on Poloniex
  var polo_current = historic_data.getRange(lastrow, 7, 1, 1).getValue() // Gets current Poloniex value
  var polo_change = ((poloAsk/usdMYR)/(polo_current/prev_usdMYR) - 1)*100 // calculate % change using actual USD value  
  
  // Extract hour from formattedTime
  var currentHour = timestamp.getHours()  
  var sendEmail = false
  if (currentHour == 8 && timestamp.getMinutes() < 5) {
    sendEmail = true
  } else if (debug) {
    sendEmail = true
  }
  
  // Indicate Timezones
  // China/MY: 8
  // UK: 15
  // US: 20 - 23
  var timezones = { 8: "China/MY", 15: "U.K", 20: "U.S.A. (NY)", 21: "U.S.A. (DC)", 22: "U.S.A. (TX)", 23: "U.S.A. (CO)", 24: "U.S.A. (CA)" }
  
//  var timedate_calc = "#VALUE!"
//  if (currentHour in timezones) {
//    var timedate_calc = Math.max(gfBTC, avg2, bxAsk, cd, poloAsk) // Max of GFinance, BitAv, BitX, CoinDesk
//  }
//  
  var timedate_calc = (currentHour in timezones) ? Math.max(gfBTC, avg2, bxAsk, cd, poloAsk) : "#VALUE!"
  
  // Append new row with new values
  var new_rowdata = [formattedDate + " " + formattedTime].concat(gfBTC, baAsk, bxAsk, bxBid, cd, poloAsk, timedate_calc, perc_change, bitx_change, polo_change , usdMYR)
  if (!debug) {
    historic_data.appendRow(new_rowdata)
    historic_data.deleteRows(2, 1)
    three_day_data.appendRow(new_rowdata)
    three_day_data.deleteRows(2, 1) //keeps latest 3-day (approx 864 lines) data minus header row
    // This is for the '1-day' chart - [BK]
    one_day_data.deleteRows(2, 1) //keeps latest 1-day (approx 328 lines) data minus header row
    one_day_data.appendRow(new_rowdata)    
  }
  
  // Create data dictionary for easier reuse
  var priceData = {
    "gfBTC": gfBTC,
    "bxBid": bxBid,
    "bxAsk": bxAsk,
    "baBid": baBid,
    "baAsk": baAsk,
    "cd": cd,
    "poloAsk": poloAsk,
    "bitx_change": bitx_change,
    "perc_change": perc_change,
    "polo_change": polo_change,
    "usdMYR": usdMYR
  }
  
  Logger.log("priceData: " + JSON.stringify(priceData))
    
  //=============================================NEW ROW HAS BEEN ADDED=================================================
  
  var sendEmail = false
  if (Math.abs(perc_change) > 0.35 || Math.abs(polo_change) > 0.75 || Math.abs(bitx_change) > 0.35) {
    sendEmail = true
  } else if (timestamp.getHours() == 8 && timestamp.getMinutes() < 5) {
    sendEmail = true
  } else if (debug) {
    sendEmail = true
  }
  
  // Send Email
  if (sendEmail) {
    var mail_cols = [1, 3, 4, 7, 9, 10]
    var testEmail = (debug) ? 1 : 0
    sendEmail(priceData, mail_cols, timezones, currentHour, testEmail)
  }
  
}