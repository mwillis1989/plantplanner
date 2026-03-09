document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock3");
if(!block) return;

block.innerHTML=`

<details>
<summary>Feet → Metres</summary>

<label>Feet</label>
<input id="ft">

<button onclick="ftMeters()">Convert</button>

<div id="mResult" class="result"></div>

</details>


<details>
<summary>Pounds → Kilograms</summary>

<label>Pounds</label>
<input id="lb">

<button onclick="lbKg()">Convert</button>

<div id="kgResult" class="result"></div>

</details>


<details>
<summary>Gallons → Litres</summary>

<label>Gallons</label>
<input id="gal">

<button onclick="galL()">Convert</button>

<div id="lResult" class="result"></div>

</details>


<details>
<summary>Temperature °F ↔ °C</summary>

<label>Fahrenheit</label>
<input id="f">

<button onclick="fC()">Convert</button>

<div id="tempResult" class="result"></div>

</details>

`;

});

function ftMeters(){mResult.innerText=(ft.value*0.3048).toFixed(3)+" m"}
function lbKg(){kgResult.innerText=(lb.value*0.453592).toFixed(3)+" kg"}
function galL(){lResult.innerText=(gal.value*3.78541).toFixed(2)+" L"}
function fC(){tempResult.innerText=((f.value-32)*5/9).toFixed(2)+" °C"}
