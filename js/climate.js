document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock1");
if(!block) return;

block.innerHTML=`

<details>
<summary>Crop DLI ↔ PPFD Converter</summary>

<label>PPFD (µmol/m²/s)</label>
<input id="ppfd">

<label>Photoperiod (hrs)</label>
<input id="hrs">

<button onclick="calcDLI()">Calculate DLI</button>
<button onclick="calcPPFD()">Calculate PPFD</button>

<div id="dliResult" class="result"></div>

</details>


<details>
<summary>DLI from Electric Light</summary>

<label>PPFD</label>
<input id="lightPPFD">

<label>Hours</label>
<input id="lightHours">

<button onclick="calcElectricDLI()">Calculate</button>

<div id="electricResult" class="result"></div>

</details>


<details>
<summary>Vapor Pressure Deficit (VPD)</summary>

<label>Temperature °C</label>
<input id="vpdTemp">

<label>Humidity %</label>
<input id="vpdRH">

<button onclick="calcVPD()">Calculate</button>

<div id="vpdResult" class="result"></div>

</details>

`;

});

function calcDLI(){
const ppfd=parseFloat(ppfd.value);
const hrs=parseFloat(hours?.value||document.getElementById("hrs").value);
const dli=(ppfd*hrs*3600)/1e6;
dliResult.innerText=dli.toFixed(2)+" mol/m²/day";
}

function calcPPFD(){
const dli=parseFloat(document.getElementById("dliInput")?.value||0);
const hrs=parseFloat(document.getElementById("hrs").value);
const ppfd=(dli*1e6)/(hrs*3600);
dliResult.innerText=ppfd.toFixed(2)+" µmol/m²/s";
}

function calcElectricDLI(){
const ppfd=parseFloat(lightPPFD.value);
const hrs=parseFloat(lightHours.value);
const dli=(ppfd*hrs*3600)/1e6;
electricResult.innerText=dli.toFixed(2)+" mol/m²/day";
}

function calcVPD(){
const t=parseFloat(vpdTemp.value);
const rh=parseFloat(vpdRH.value);
const es=0.6108*Math.exp((17.27*t)/(t+237.3));
const ea=(rh/100)*es;
const vpd=es-ea;
vpdResult.innerText=vpd.toFixed(2)+" kPa";
}
