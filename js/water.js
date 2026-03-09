document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock6");
if(!block) return;

block.innerHTML=`

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water Volume (L)</label>
<input id="waterVol">

<label>Target ppm</label>
<input id="targetPPM">

<label>Peroxide %</label>
<input id="peroxidePercent">

<button onclick="peroxide()">Calculate</button>

<div id="peroxideResult" class="result"></div>

</details>


<details>
<summary>Irrigation Water Requirement</summary>

<label>Area m²</label>
<input id="waterArea">

<label>L per m²</label>
<input id="waterRate">

<button onclick="waterUse()">Calculate</button>

<div id="waterResult" class="result"></div>

</details>


<details>
<summary>Annual Water Storage</summary>

<label>Storage m³</label>
<input id="storage">

<label>Days</label>
<input id="days">

<button onclick="waterStorage()">Calculate</button>

<div id="storageResult" class="result"></div>

</details>

`;

});

function peroxide(){
peroxideResult.innerText=((targetPPM.value*waterVol.value)/(peroxidePercent.value*10)).toFixed(2)+" mL";
}

function waterUse(){
waterResult.innerText=(waterArea.value*waterRate.value).toFixed(0)+" L/day";
}

function waterStorage(){
storageResult.innerText=(storage.value/days.value).toFixed(2)+" days supply";
}
