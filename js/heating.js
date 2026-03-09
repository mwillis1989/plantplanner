document.addEventListener("DOMContentLoaded", function(){

const block = document.getElementById("calcBlock4");
if(!block) return;

block.innerHTML = `

<details>
<summary>Greenhouse Heat Loss</summary>

<label>Area (ft²)</label>
<input id="ghArea">

<label>U Value</label>
<input id="ghU">

<label>Temp Difference (°F)</label>
<input id="ghDelta">

<button onclick="calcHeatLoss()">Calculate</button>

<div id="heatResult" class="result"></div>

</details>

<details>
<summary>Ventilation Requirement</summary>

<label>Length (ft)</label>
<input id="ventLength">

<label>Width (ft)</label>
<input id="ventWidth">

<label>CFM per ft²</label>
<input id="ventRate">

<button onclick="calcVent()">Calculate</button>

<div id="ventResult" class="result"></div>

</details>

`;

});

function calcHeatLoss(){

const area=parseFloat(document.getElementById("ghArea").value);
const U=parseFloat(document.getElementById("ghU").value);
const dT=parseFloat(document.getElementById("ghDelta").value);

const loss=area*U*dT;

document.getElementById("heatResult").innerText=loss.toFixed(0)+" BTUH";

}

function calcVent(){

const L=parseFloat(document.getElementById("ventLength").value);
const W=parseFloat(document.getElementById("ventWidth").value);
const rate=parseFloat(document.getElementById("ventRate").value);

const cfm=L*W*rate;

document.getElementById("ventResult").innerText=cfm.toFixed(0)+" CFM";

}
