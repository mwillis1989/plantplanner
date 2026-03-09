document.addEventListener("DOMContentLoaded", function () {

const block = document.getElementById("calcBlock1");
if (!block) return;

block.innerHTML = `

<details id="cropConverter">
<summary>DLI ↔ PPFD Converter (Crop Presets)</summary>

<p>Select a crop to auto-populate typical PPFD ranges.</p>

<label>Select Crop:</label>
<select id="cropSelect" onchange="cropOnSelect()">
<option value="">-- Choose Crop --</option>
<option value="tomato">Tomato</option>
<option value="pepper">Pepper</option>
<option value="cucumber">Cucumber</option>
<option value="cannabisVeg">Cannabis (Veg)</option>
<option value="cannabisFlower">Cannabis (Flower)</option>
<option value="orchid">Orchid</option>
<option value="custom">Custom</option>
</select>

<label>Photoperiod (hrs)</label>
<input id="hoursInput">

<label>PPFD (µmol/m²/s)</label>
<input id="ppfdInput">

<label>DLI (mol/m²/day)</label>
<input id="dliInput">

<button onclick="cropCalculateDLI()">Calculate DLI</button>
<button onclick="cropCalculatePPFD()">Calculate PPFD</button>

<div id="resultOutput" class="result"></div>
<div id="notesOutput"></div>

</details>


<details>
<summary>DLI from Electric Light</summary>

<label>Light Intensity (µmol/m²/s)</label>
<input id="lightIntensity">

<label>Photoperiod (hrs)</label>
<input id="photoperiod">

<button onclick="calculateElectricDLI()">Calculate</button>

<div id="electricDliOutput" class="result"></div>

</details>


<details>
<summary>Estimate DLI from Peak Sunlight</summary>

<label>Light Units</label>

<label><input type="radio" name="sunUnit" value="ppfd" checked> PPFD</label>
<label><input type="radio" name="sunUnit" value="lux"> Lux</label>
<label><input type="radio" name="sunUnit" value="watts"> W/m²</label>

<label>Peak Light</label>
<input id="sunPeakValue">

<label>Sunrise (HHMM)</label>
<input id="sunriseTime">

<label>Sunset (HHMM)</label>
<input id="sunsetTime">

<button onclick="calculateSunlightDLI()">Calculate</button>

<div id="sunDliOutput" class="result"></div>

</details>


<details>
<summary>VPD Calculator</summary>

<label>Temperature Unit</label>
<label><input type="radio" name="vpdTempUnit" value="c" checked> °C</label>
<label><input type="radio" name="vpdTempUnit" value="f"> °F</label>

<label>Relative Humidity (%)</label>
<input id="rhVPD">

<label>Air Temperature</label>
<input id="airTempVPD">

<label>Leaf Temperature (optional)</label>
<input id="leafTempVPD">

<button onclick="calculateVPD()">Calculate</button>

<div id="vpdOutput" class="result"></div>

</details>


<details>
<summary>DLI vs Photoperiod</summary>

<label>PPFD</label>
<input id="graphPPFD">

<button onclick="drawGraph()">Generate Table</button>

<div id="graphResult"></div>

</details>

`;

});


const cropData = {
tomato:{min:170,max:350,typical:270},
pepper:{min:120,max:300,typical:230},
cucumber:{min:120,max:350,typical:230},
cannabisVeg:{min:280,max:350,typical:300},
cannabisFlower:{min:650,max:1500,typical:1000},
orchid:{min:80,max:230,typical:160}
};


function cropOnSelect(){

const crop=document.getElementById("cropSelect").value;
const notes=document.getElementById("notesOutput");

if(!cropData[crop]) return;

const data=cropData[crop];

document.getElementById("ppfdInput").value=data.typical;

notes.innerHTML=`PPFD Range: ${data.min} – ${data.max}`;
}


function cropCalculateDLI(){

const ppfd=parseFloat(ppfdInput.value);
const hrs=parseFloat(hoursInput.value);

const dli=(ppfd*hrs*3600)/1e6;

dliInput.value=dli.toFixed(2);

resultOutput.innerText=`DLI = ${dli.toFixed(2)} mol/m²/day`;
}


function cropCalculatePPFD(){

const dli=parseFloat(dliInput.value);
const hrs=parseFloat(hoursInput.value);

const ppfd=(dli*1e6)/(hrs*3600);

ppfdInput.value=ppfd.toFixed(2);

resultOutput.innerText=`PPFD = ${ppfd.toFixed(2)} µmol/m²/s`;
}


function calculateElectricDLI(){

const intensity=parseFloat(lightIntensity.value);
const photoperiod=parseFloat(photoperiod.value);

const dli=intensity*photoperiod*3600*1e-6;

electricDliOutput.innerText=dli.toFixed(2);
}


function calculateSunlightDLI(){

const peak=parseFloat(sunPeakValue.value);

const sunrise=parseInt(sunriseTime.value.slice(0,2));
const sunset=parseInt(sunsetTime.value.slice(0,2));

const hours=sunset-sunrise;

const dli=(peak*hours*3600)/1e6;

sunDliOutput.innerText=dli.toFixed(2);
}


function calculateVPD(){

const rh=parseFloat(rhVPD.value);
let t=parseFloat(airTempVPD.value);

const es=0.6108*Math.exp((17.27*t)/(t+237.3));
const ea=(rh/100)*es;

vpdOutput.innerText=(es-ea).toFixed(2)+" kPa";
}


function drawGraph(){

const ppfd=parseFloat(graphPPFD.value);

let text="";

for(let h=8;h<=20;h+=2){

const dli=(ppfd*h*3600)/1e6;

text+=`${h} hrs → ${dli.toFixed(2)} mol/m²/day<br>`;
}

graphResult.innerHTML=text;

}
