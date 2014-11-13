var departures = new Array();
//var stop_name = "Jade HS";
var textsize = 40;
var departure_rows = 0;
var current_stop_count = 0;
var alerts = 0;


//Set the timeout times for reloading in milliseconds
var timeout_reload_departures = 30000;
var timeout_reload_alerts = 60000;

//Read URL Parmeters
var stop_ids = get_url_param("stops").split(",");
var lat = get_url_param("lat");
var lng = get_url_param("lng");
var agencys = get_url_param("agencys").split(",");
var stop_name = decodeURIComponent(get_url_param("stopname"));
$("#title").html(stop_name);


$( document ).ready(function() {
	var available_height = window.innerHeight;
	
	//Create the Header Table with Stop Name and Clock
	var header_table = "<table id='main_table'>" +
			"<tr>" +
			"<td id='td_stop_name' colspan='2'>"+stop_name+"</td>" +
			"<td id='td_clock'><div id='div_clock'>88:88:88</div></td>" +
			"</tr>" +
			"<tr>" +
			"<td id='td_route_header'>Linie</td>" +
			"<td id='td_destination_header'>Ziel</td>" +
			"<td id='td_departure_header'>Abfahrt</td>" +
			"</tr>" +
			"</table>";	
	$("#content").append(header_table);
	
	//Reduce available with the value from the header table 
	available_height -= parseInt($("#main_table").css("height"));
	
	
	//Calculate the Number of possible lines
	var possibile_lines_double = available_height / line_height();
	var possibile_lines_int = parseInt(possibile_lines_double);
	departure_rows = possibile_lines_int;
	
	//Calculate how many pixels we must add to the first Line, so that the
	//last line end exactly on the bottom of the Page
	//and resize the first line 
	var height_to_add_to_header_line = (possibile_lines_double - possibile_lines_int) * line_height(); 
	var height_header_line = parseFloat($("#td_stop_name").css("height"));
	height_header_line += height_to_add_to_header_line;
	height_header_line = height_header_line - departure_rows - 6;
	$("#td_stop_name").css("height",height_header_line+"px");
	
	//Zeilen einfügen
	for(var i = 0; i < departure_rows;i++){
		$('#main_table tr:last').after("<tr id='row_"+i+"' class='departure_row'><td style='height: "+line_height()+"px'id='row_"+i+"_route'>&nbsp;</td><td id='row_"+i+"_destination'>&nbsp;</td><td id='row_"+i+"_departure' class='departure'>&nbsp;</td></tr>");
	}
	
	clock("div_clock");
		
	display_departures();
	
	load_alerts();

	
});

function display_departures(){
	current_stop_count = 0;
	departures = new Array();
	get_data();
}

function get_data(){
	var now = new Date();
	start_time = Date.parse(now);
	end_time = start_time+86400000;
	console.log(proxy_URL +"/api/transit/arrivalsAndDeparturesForStop?lat="+lat+"&lon="+lng+"&agencyId=&stopId="+stop_ids[current_stop_count]+"&startTime="+start_time+"&endTime="+end_time+"&numArrivals=0&numDepartures="+departure_rows)
	$.getJSON(proxy_URL +"/api/transit/arrivalsAndDeparturesForStop?lat="+lat+"&lon="+lng+"&agencyId=&stopId="+stop_ids[current_stop_count]+"&startTime="+start_time+"&endTime="+end_time+"&numArrivals=0&numDepartures="+departure_rows,function(data){
		for(i = 0;i < data.length;i++){
			for(j = 0;j < data[i].data.departures.length;j++){
				departures.push(data[i].data.departures[j]);	
			}
		}
		current_stop_count++;
		if(current_stop_count < stop_ids.length){
			get_data();
		}
		else{
			display_data();
		}
	});	
}

function display_data(){
	departures.sort(dynamicSort("time"));
	for(var i = 0;i < (departure_rows-alerts);i++){
		//If the RouteShortName is not Set don't Display it
		if(typeof departures[i].routeShortName === 'undefined')
			routeShortName = "";
		else
			routeShortName = departures[i].routeShortName;
		
		//Calculate the Time until departure
		time = calculate_departue_time(departures[i].time);
		
		tripHeadsign = departures[i].tripHeadsign;
		
		$("#row_"+i+"_route").html(routeShortName);
		$("#row_"+i+"_destination").html(tripHeadsign);
		$("#row_"+i+"_departure").html(time);
	}
	setTimeout("display_departures()",timeout_reload_departures);
}

function load_alerts(){
	//array to Store the alerts
	var alert_messages = new Array();
	
	var agency_stop_combinations = new Array();
	
	for(var i = 0;i < stop_ids.length;i++){
		for(var j = 0; j < agencys.length;j++){			
			combination = new Array();
			combination.agency = agencys[j];
			combination.stop = stop_ids[i];
			agency_stop_combinations.push(combination);
		}
	}
	load_alerts_from_server(agency_stop_combinations,alert_messages);
}

function load_alerts_from_server(agency_stop_combinations,alert_messages){
	$.getJSON(proxy_URL +"/api/transit/alerts?lat="+lat+"&lon="+lng+"&agencyId="+agency_stop_combinations[0].agency+"&stopId="+agency_stop_combinations[0].stop,function(data){
		
		for(var i = 0; i < data.length;i++){
			for(var j = 0; j < data[i].data.patches.length;j++){
				alert_messages.push(data[i].data.patches[j]);
			}
		}
		agency_stop_combinations.shift();
		if(agency_stop_combinations.length == 0)
			add_alerts_to_screen(alert_messages);
		else
			load_alerts_from_server(agency_stop_combinations,alert_messages);
		
	});
}

function add_alerts_to_screen(alert_messages){
	//Check if there are alerts if not check if they are active and than remove the last row ad replace it with
	//with a nomal departure row
	if(alert_messages.length > 0){
		alert_text = new Array();
		for(var i = 0;i < alert_messages.length;i++){
			//Check if there is a text in the same language like the browser
			if(typeof alert_messages[i].alert.alertHeaderText.translations[navigator.language] === 'undefined'){
				//ok no Text in the Local Language defined, see if there is a text in english "en"
				if(typeof alert_messages[i].alert.alertHeaderText.en === 'undefined'){
					//Ok Also no defined english, so we read all keys and use the first in the list
					var keys = Object.keys(alert_messages[i].alert.alertHeaderText.translations);
					//Check if the Message is already in the Array "alert_text", if no add it!
					if(jQuery.inArray(alert_messages[i].alert.alertHeaderText.translations[keys[0]],alert_text) == "-1")
						alert_text.push(alert_messages[i].alert.alertHeaderText.translations[keys[0]]);
				}
				else{
					//Check if the Message is already in the Array "alert_text", if no add it!
					if(jQuery.inArray(alert_messages[i].alert.alertHeaderText.translations.en,alert_text) == "-1")
						alert_text.push(alert_messages[i].alert.alertHeaderText.translations.en);
				}
			}
			else{
				//Check if the Message is already in the Array "alert_text", if no add it!
				if(jQuery.inArray(alert_messages[i].alert.alertHeaderText.translations[navigator.language],alert_text) == "-1")
					alert_text.push(alert_messages[i].alert.alertHeaderText.translations[navigator.language]);
			}
				
		}
		var html = "<marquee>"+alert_text.join(" +++ ")+"</marquee>";
	
		//Check if Alerts already there, if yes the last row is already
		//correct and we only need to change the content
		//If no then we must remove the last departure row and must replace it for the alert row
		if(alerts == 0){
			//set alerts to "1"
			alerts = 1;
			
			//Ok we must Modify the table
			//First remove the last row
			$('#main_table tr:last').remove();
			
			//Now Add the new Row
			$('#main_table tr:last').after("<tr><td id='td_alerts' class='departure_row' style='height: "+line_height()+"px;' colspan='3'>Test</td></tr>");
		}
		$("#td_alerts").html(html);
	}
	else{
		//OK here are now alerts
		//Check if we alerts are active than we must remove the last row
		if(alerts == 1){
			//set Alerts to 0
			alerts = 0;
			$('#main_table tr:last').remove();			
			$('#main_table tr:last').after("<tr id='row_"+departure_rows-1+"' class='departure_row'><td style='height: "+line_height()+"px'id='row_"+departure_rows-1+"_route'>&nbsp;</td><td id='row_"+departure_rows-1+"_destination'>&nbsp;</td><td id='row_"+departure_rows-1+"_departure' class='departure'>&nbsp;</td></tr>");		
		}
	}
	setTimeout("load_alerts()",timeout_reload_departures);
}

function line_height(){
	return textsize * 1.95;
}	

function clock(id){
    time = new Date();
    var hour = time.getHours();
    var minute = time.getMinutes();
    var second = time.getSeconds();
    if(hour < 10)
    	hour = "0" + hour;
    if(minute < 10)
        minute = "0" + minute;
    if(second < 10)
    	second = "0" + second;
    if(document.getElementById(id)){
        document.getElementById(id).innerHTML =  hour + ":" + minute + ":" + second;
        setTimeout("clock('"+id+"')",100);
    }
    else{
    	//console.log("uhr weg");
    	return false;    	
    }
        

}

function get_url_param( name )
{
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");

	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var results = regex.exec( window.location.href );

	if ( results == null )
		return "";
	else
		return results[1];
}

function calculate_departue_time(timestamp){
	//when the Vehicle is driving in the next 60 Minutes show
	//how many minutes until the vehicles drive
	//if it is over 60 Minutes show the Time in the format hh.mm
	timedelta = parseInt( (timestamp - Date.parse(new Date())) /1000/60);
	if(timedelta < 60){
		if(timedelta == 0)
			return "sofort";
		return "in&nbsp;"+timedelta+"&nbsp;min";
	}
		
	
	timeobj = new Date(timestamp*1);
	var hour = timeobj.getHours();
    var minute = timeobj.getMinutes();
    if(hour < 10)
    	hour = "0" + hour;
    if(minute < 10)
        minute = "0" + minute;
    
    return hour +":"+minute;
}

//http://stackoverflow.com/questions/1129216/sorting-objects-in-an-array-by-a-field-value-in-javascript
function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}