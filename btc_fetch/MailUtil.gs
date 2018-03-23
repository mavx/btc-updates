function createMailTable(mail_cols) { // mail_cols must be an array of chosen columns!
  // Choose columns to include
  var lastrow = historic_data.getLastRow()
  Logger.log("lastrow: " + lastrow)
  
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

function sendEmail(priceData, mail_cols, timezones, currentHour, isTest) {
  Logger.log("Sending email...")
  var emailRemainingQuota = MailApp.getRemainingDailyQuota()
  var timestamp = new Date()
  var mail_timestamp = Utilities.formatDate(timestamp, "GMT+08:00", "yyyyMMdd"); // used to create email reference id below
  
  // Fetch last 6 price updates into array
  var header_array = createMailTable(mail_cols)[0]
  var mailvalues_array = createMailTable(mail_cols)[1]
  var emailAddress = (isTest == 1) ? "email1@gmail.com" : "email2@gmail.com"
  var otherEmails = ""
  var subject = "BTC: RM " + priceData["baAsk"].toFixed(2) + " (" + priceData["perc_change"].toFixed(2) + "%), "
  subject += "BitX: RM " + priceData["bxAsk"].toFixed(0) + " (" + priceData["bitx_change"].toFixed(2) + "%), "
  subject += "Polo: RM " + priceData["poloAsk"].toFixed(2) + " (" + priceData["polo_change"].toFixed(2) + "%)."
  
  // Fetch BTC Movement Chart
  var chartURL = "https://docs.google.com/spreadsheets/d/1ElP8TM64Envsux-v2HtCYkP6Oary2EgNjNt9GiOPHOk/pubchart?oid=2080659137&format=image"
  //    var chartBlob = UrlFetchApp.fetch(chartURL).getBlob().setName("Historical BTC Chart")
  var chart3URL = "https://docs.google.com/spreadsheets/d/1ElP8TM64Envsux-v2HtCYkP6Oary2EgNjNt9GiOPHOk/pubchart?oid=1266927471&format=image"
  var chart3Blob = UrlFetchApp.fetch(chart3URL).getBlob().setName("3-Day BTC Chart")
  var chart1URL = "https://docs.google.com/spreadsheets/d/1ElP8TM64Envsux-v2HtCYkP6Oary2EgNjNt9GiOPHOk/pubchart?oid=259958032&format=image"
  var chart1Blob = UrlFetchApp.fetch(chart1URL).getBlob().setName("1-Day BTC Chart")
  
  
  // Design the message
  var message = "<img src='cid:chart3Blob'><br><br>" // Insert BTC Movement Graph
  if (currentHour in timezones) { message += "It is morning in " + timezones[currentHour] + ". " } // Insert who's waking up at this time
  message += "The thickest grey column indicate 8am in US, followed by China/Malaysia, and UK.<br><br>"
  message += "<img src='cid:chart1Blob'><br><br>" // Insert BTC Movement Graph [1-Day]
  message += "<b>Here are the 6 most recent price updates (5-min interval, oldest-first): </b><br>"
  message += makeTableHTML(header_array, mailvalues_array) + "<br>"
  message += "Current USD-MYR rate: " + priceData["usdMYR"].toFixed(3) + "<br><br>"
  message += "You are set to receive this email if there is at least 0.35% change in average BTC price within the last 5 minutes. "
  message += "You may also check out the charts below (updated every 5 minutes): <br>" // INTERACTIVE -> https://goo.gl/LlMhrj
  message += "<ul>"
  //    message += "<li>Historical Chart (image): <a href='https://goo.gl/rpE04V'>Link</a></li>"
  message += "<li>3-Day Movement Chart (image): <a href='https://goo.gl/p49O59'>Link</a></li>"
  message += "<li>1-Day Movement Chart (image): <a href='https://goo.gl/gLGDea'>Link</a></li>"
  message += "</ul>"
  // message += "<li>Historical Chart (interactive): <a href='https://goo.gl/LlMhrj'>Link</a></li><br><br>"
  message += "<p style='font-size:80%;'><i>Disclaimer: This alert is still in pilot stage and is continuously being improved, "
  message += "so you may receive funny emails at times. Thanks for bearing with the bugs while they're being squashed. "
  message += "Click <a href='https://goo.gl/ZleCpm'>here</a> for the changelog.</i></p>"
  message += "<p style='font-size:80%;'><i>alert-id: " + mail_timestamp + "-" + (101-emailRemainingQuota) + "</i></p>"
  
  // Send the email!
  MailApp.sendEmail({
    name: "BTC Price Update",
    to: emailAddress,
    //cc: otherEmails,
    subject: subject,
    htmlBody: message,
    inlineImages: {
      //        chartBlob: chartBlob,
      chart3Blob: chart3Blob,
      chart1Blob: chart1Blob
    }
  })
  
  // Print message
  Logger.log(message)
}
