document.addEventListener("DOMContentLoaded", function(){

const block = document.getElementById("calcBlock6");
if(!block) return;

block.innerHTML = `

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water Volume (L)</label>
<input id="waterVol">

<label>H₂O₂ Strength %</label>
<input id="peroxideStrength">

<label>Target ppm</label>
<input id="targetPPM">

<button onclick="calcPeroxide()">Calculate</button>

<div id="peroxideResult" class="result"></div>

</details>

<details>
<summary>Irrigation Water Requirement</summary>

<label>Area m²</label>
<input id="irArea">

<label>L per m²</label>
<input id="irRate">

<button onclick="calcWater()">Calculate</button>

<div id="waterResult" class="result"></div>

</details>

`;

});

function calcPeroxide(){

const vol=parseFloat(document.getElementById("waterVol").value);
const strength=parseFloat(document.getElementById("peroxideStrength").value);
const ppm=parseFloat(document.getElementById("targetPPM").value);

const ml=(ppm*vol)/(strength*10);

document.getElementById("peroxideResult").innerText=ml.toFixed(2)+" mL peroxide";

}

function calcWater(){

const area=parseFloat(document.getElementById("irArea").value);
const rate=parseFloat(document.getElementById("irRate").value);

const litres=area*rate;

document.getElementById("waterResult").innerText=litres.toFixed(0)+" L/day";

}
