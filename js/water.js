document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock6");
if(!block) return;

block.innerHTML=`

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water Volume (L)</label>
<input id="vol">

<label>H₂O₂ Strength %</label>
<input id="strength">

<label>Target ppm</label>
<input id="ppm">

<button onclick="peroxide()">Calculate</button>

<div id="peroxideResult" class="result"></div>

</details>


<details>
<summary>Irrigation Water Requirement</summary>

<label>Area m²</label>
<input id="areaW">

<label>L per m²</label>
<input id="rateW">

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
peroxideResult.innerText=((ppm.value*vol.value)/(strength.value*10)).toFixed(2)+" mL";
}

function waterUse(){
waterResult.innerText=(areaW.value*rateW.value).toFixed(0)+" L/day";
}

function waterStorage(){
storageResult.innerText=(storage.value/days.value).toFixed(2)+" days supply";
}
