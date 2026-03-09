const convBlock = document.getElementById("calcBlock3");

convBlock.innerHTML = `

<details>
<summary>Feet ↔ Metres</summary>

<label>Feet</label>
<input id="feetInput">

<button onclick="feetToMeters()">Convert</button>

<div id="metersResult" class="result"></div>

</details>

<details>
<summary>Pounds ↔ Kilograms</summary>

<label>Pounds</label>
<input id="lbInput">

<button onclick="lbToKg()">Convert</button>

<div id="kgResult" class="result"></div>

</details>

<details>
<summary>Gallons ↔ Litres</summary>

<label>US Gallons</label>
<input id="galInput">

<button onclick="galToLitres()">Convert</button>

<div id="litreResult" class="result"></div>

</details>

`;

function feetToMeters(){

const ft=parseFloat(document.getElementById("feetInput").value);

const m=ft*0.3048;

document.getElementById("metersResult").innerText=m.toFixed(3)+" m";

}

function lbToKg(){

const lb=parseFloat(document.getElementById("lbInput").value);

const kg=lb*0.453592;

document.getElementById("kgResult").innerText=kg.toFixed(3)+" kg";

}

function galToLitres(){

const gal=parseFloat(document.getElementById("galInput").value);

const l=gal*3.78541;

document.getElementById("litreResult").innerText=l.toFixed(2)+" L";

}
