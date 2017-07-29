// Activate to "true" when testing, will have following impacts:
// ==> emailAddress set to email@example.com
// ==> email criteria always set to run
// ==> appendRow is turned off for both Historic and 3DayData
var test = false

// Define global variables
var ss = SpreadsheetApp.getActiveSpreadsheet()
var historic_data = ss.getSheetByName("Historic")
var three_day_data = ss.getSheetByName("3DayData")
var dashboard = ss.getSheetByName("Dashboard")
var source = ss.getSheetByName("Sources")

function print(string) {
  Browser.msgBox(string)
}

// Let's define a function to make writing values to cells easier...
function writeToCell(sheet, CellRange, WriteValue) {
  sheet.getRange(CellRange).setValue(WriteValue);
}

// Function for extracting price format
function extract_price(source, fromText) {
  var priceRegex = /\d+\.\d+|\d+\,\d+\.\d+|\d/ // extracts first price in XX.XX or X,XXX.XX or XXXX format
  var substr = source.substring(source.indexOf(fromText))
  var price = substr.match(priceRegex)
  return parseFloat(price)
}

function createMailTable(mail_cols) { // mail_cols must be an array of chosen columns!
  // Choose columns to include
  var lastrow = historic_data.getLastRow()
  
  //var mail_cols = [1, 3, 4, 7, 8]
  var header_array = [[]]
  var col_array = []
  
  // Get Mail Table Header
  for (var i=0; i<mail_cols.length; i++) {
    header_array[0].push(historic_data.getRange(1, mail_cols[i], 1, 1).getDisplayValue())
    }
  
  // Get Mail Table Values by column
  for (var i=0; i<mail_cols.length; i++) {
    col_array.push(historic_data.getRange(lastrow-5, mail_cols[i], 6, 1).getDisplayValues()) //get last 6 values for each Column
    }
  
  // Define array structure to be used for makeTableHTML()
  var newMailArray = []
  for (var i=0; i<6; i++) {newMailArray.push([])}
  
  // Transpose column arrays into row arrays
  for (var i=0; i<newMailArray.length; i++) {
    for (var j=0; j<newMailArray.length; j++) {
      newMailArray[i][j] = String(col_array[j][i])
    }
  }

  var result = [header_array, newMailArray]
  return result
}

// Make Table for email
function makeTableHTML(header, values) {
  var result = "<table border='1'; style='width:80%; border-collapse:collapse;'>";
  
  // Design table headers
  for (var i=0; i<header.length; i++) {
    result += "<tr style='background-color:#DDDDDD'>"
    for(var j=0; j<header[i].length; j++) {
      result += "<th style='padding:8px;'>" + header[i][j] + "</th>";
    }
    result += "</tr>"
  }
    
  // Design table rows
  for (var i=0; i<values.length; i++) {
    result += "<tr>" // +myArray[i];
    for(var j=0; j<values[i].length; j++) {
      if (typeof values[i][j] == "number") { // making values more reader-friendly
        result += "<td style='padding:8px;'>" + values[i][j].toFixed(2) + "</td>";
      }
      else {
        result += "<td style='padding:8px;'>" + values[i][j] + "</td>";
      }
    }
    result += "</tr>";
  }
  result += "</table>";
  return result
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
  
  // Query the BTC market data API to a cell
  var BitX = UrlFetchApp.fetch("https://api.mybitx.com/api/1/ticker?pair=XBTMYR").getContentText();
  var BitAv = UrlFetchApp.fetch("https://apiv2.bitcoinaverage.com/indices/global/ticker/BTCUSD").getContentText();
  var CoinDesk = UrlFetchApp.fetch("https://api.coindesk.com/v1/bpi/currentprice/MYR.json").getContentText();
  var Poloniex = UrlFetchApp.fetch("https://poloniex.com/public?command=returnTicker").getContentText();
  var polo = Poloniex.substring(Poloniex.indexOf("USDT_BTC"), Poloniex.indexOf("USDT_BTC")+400)

  writeToCell(source, 'B2', BitX);
  writeToCell(source, 'B3', BitAv);
  writeToCell(source, 'B4', CoinDesk);
  writeToCell(source, 'B5', Poloniex);

  // Add timestamp
  var timestamp = new Date()
  var formattedDate = Utilities.formatDate(timestamp, "GMT+08:00", "EEE, d-MMM-yy");
  var formattedTime = Utilities.formatDate(timestamp, "GMT+08:00", "HH:mm");
  var mail_timestamp = Utilities.formatDate(timestamp, "GMT+08:00", "yyyyMMdd"); // used to create email reference id below
  writeToCell(dashboard, 'B1', formattedDate);
  writeToCell(dashboard, 'C1', formattedTime);
  
  // Get previous and new USD exchange rate
  var prev_usdMYR = parseFloat(historic_data.getRange(lastrow, 12, 1, 1).getValue()) // Stores previous usdMYR value
  var usdMYR = parseFloat(dashboard.getRange("B2").getValue()) //Use existing GoogleFinance USDMYR rate
  
  // Extract then store bid and ask prices in MYR
  var gfBTC = parseFloat(dashboard.getRange("B5").getValue()) * usdMYR //Use existing GoogleFinance USDMYR rate
  var bxBid = extract_price(BitX, "bid")
  var bxAsk = extract_price(BitX, "ask")
  var baBid = extract_price(BitAv, "bid") * usdMYR
  var baAsk = extract_price(BitAv, "ask") * usdMYR
  var cd = extract_price(CoinDesk, '"USD","rate"') * usdMYR
  var poloAsk = extract_price(polo, "lowestAsk") * usdMYR
  
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
  var t_parse = Number(formattedTime.substring(0,2))
  
  // Get current time
  var datetime = new Date()
  if (datetime.getHours() == 8 && datetime.getMinutes() < 5) {
    var daily_email = true
  }
  
  // Indicate Timezones
  // China/MY: 8
  // UK: 15
  // US: 20 - 23
  var timezones = { 8: "China/MY", 15: "U.K", 20: "U.S.A. (NY)", 21: "U.S.A. (DC)", 22: "U.S.A. (TX)", 23: "U.S.A. (CO)", 24: "U.S.A. (CA)" }
  
  if (t_parse in timezones) {
    var timedate_calc = Math.max(gfBTC, avg2, bxAsk, cd, poloAsk) // Max of GFinance, BitAv, BitX, CoinDesk
    var morning = true
  } else {
    timedate_calc = "#VALUE!"
  }
  
  // Append new row with new values
  var new_rowdata = [formattedDate + " " + formattedTime].concat(gfBTC, baAsk, bxAsk, bxBid, cd, poloAsk, timedate_calc, perc_change, bitx_change, polo_change , usdMYR)
  if (test != true) {
    historic_data.appendRow(new_rowdata)
    three_day_data.appendRow(new_rowdata)
    three_day_data.deleteRows(2, 1) //keeps latest 3-day (approx 864 lines) data minus header row
  }
  
  //=============================================NEW ROW HAS BEEN ADDED=================================================

  // Email criteria
  if (Math.abs(perc_change) > 0.35 || Math.abs(bitx_change) > 0.35 || Math.abs(polo_change) > 0.75 || daily_email || test) {
    // Add bitx_change temporarily 2016-11-30
    // bitx_change ignored since it perpetually lags behind perc_change. This should reduce notifications too
    // Fetch last 6 price updates into array
    var mail_cols = [1, 3, 4, 7, 9, 10]
    var header_array = createMailTable(mail_cols)[0]
    var mailvalues_array = createMailTable(mail_cols)[1]
    if (test != true) { var emailAddress = "email@example.com" }
    else { var emailAddress = "email@example.com" }
    var otherEmails = ""
    var subject = "BTC: RM " + baAsk.toFixed(2) + " (" + perc_change.toFixed(2) + "%), "
    subject += "BitX: RM " + bxAsk.toFixed(0) + " (" + bitx_change.toFixed(2) + "%), "
    subject += "Polo: RM " + poloAsk.toFixed(2) + " (" + polo_change.toFixed(2) + "%)."
    var emailRemainingQuota = MailApp.getRemainingDailyQuota()
    
    // Fetch BTC Movement Chart
    var chartURL = "YOURCHARTURL"
    var chartBlob = UrlFetchApp.fetch(chartURL).getBlob().setName("Historical BTC Chart")
    var chart3URL = "YOURCHARTURL"
    var chart3Blob = UrlFetchApp.fetch(chart3URL).getBlob().setName("3-Day BTC Chart")
    
    // Design the message
    var message = "<img src='cid:chart3Blob'><br><br>" // Insert BTC Movement Graph
    if (morning) { message += "It is morning in " + timezones[t_parse] + ". " } // Insert who's waking up at this time
    message += "The thickest grey column indicate 8am in US, followed by China/Malaysia, and UK.<br><br>"
    message += "<b>Here are the 6 most recent price updates (5-min interval, oldest-first): </b><br>"
    message += makeTableHTML(header_array, mailvalues_array) + "<br>"
    message += "Current USD-MYR rate: " + usdMYR.toFixed(3) + "<br><br>"
    message += "You are set to receive this email if there is at least 0.35% change in average BTC price within the last 5 minutes. "
    message += "You may also check out the charts below (updated every 5 minutes): <br>" // INTERACTIVE -> YOURLINK
    message += "<ul>"
    message += "<li>Historical Chart (image): <a href='YOURLINK'>Link</a></li>"
    message += "<li>3-Day Movement Chart (image): <a href='YOURLINK'>Link</a></li>"
    message += "</ul>"
    // message += "<li>Historical Chart (interactive): <a href='YOURLINK'>Link</a></li><br><br>"
    message += "<p style='font-size:80%;'><i>Disclaimer: This alert is still in pilot stage and is continuously being improved, "
    message += "so you may receive funny emails at times. Thanks for bearing with the bugs while they're being squashed.</i></p>"
    message += "<p style='font-size:80%;'><i>alert-id: " + mail_timestamp + "-" + (101-emailRemainingQuota) + "</i></p>"
    
    // Send the email!
    MailApp.sendEmail({
      name: "BTC Price Update",
      to: emailAddress,
      //cc: otherEmails,
      subject: subject,
      htmlBody: message,
      inlineImages: {
        chartBlob: chartBlob,
        chart3Blob: chart3Blob
      }
    })
  }

  if (test == true) { print(message) }
}
