const climateBlock = document.getElementById("calcBlock1");

  climateBlock.innerHTML = `

<details>
<summary>Crop DLI ↔ PPFD Converter</summary>

<div class="field">
<label>PPFD (µmol/m²/s)</label>
<input id="ppfdInput">
</div>

<div class="field">
<label>Photoperiod (hrs)</label>
<input id="hoursInput">
</div>

<div class="field">
<label>DLI</label>
<input id="dliInput">
</div>

<br>

<button onclick="cropCalculateDLI()">Calculate DLI</button>
<button onclick="cropCalculatePPFD()">Calculate PPFD</button>

</details>

<details>
<summary>Vapor Pressure Deficit (VPD)</summary>

<label>Temperature °C</label>
<input id="vpdTemp">

<label>Humidity %</label>
<input id="vpdRH">

<button onclick="calculateVPD()">Calculate</button>

<div id="vpdResult" class="result"></div>

</details>
`;

function cropCalculateDLI(){

const ppfd=parseFloat(document.getElementById("ppfdInput").value);
const hrs=parseFloat(document.getElementById("hoursInput").value);

if(!ppfd||!hrs)return;

const dli=(ppfd*hrs*3600)/1000000;

document.getElementById("dliInput").value=dli.toFixed(2);

}

function cropCalculatePPFD(){

const dli=parseFloat(document.getElementById("dliInput").value);
const hrs=parseFloat(document.getElementById("hoursInput").value);

if(!dli||!hrs)return;

const ppfd=(dli*1000000)/(hrs*3600);

document.getElementById("ppfdInput").value=ppfd.toFixed(2);

}

function calculateVPD(){

const temp=parseFloat(document.getElementById("vpdTemp").value);
const rh=parseFloat(document.getElementById("vpdRH").value);

const es=0.6108*Math.exp((17.27*temp)/(temp+237.3));
const ea=(rh/100)*es;

const vpd=es-ea;

document.getElementById("vpdResult").innerText=vpd.toFixed(2)+" kPa";

}
