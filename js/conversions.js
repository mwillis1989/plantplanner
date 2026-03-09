document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock3")

block.innerHTML=`

<details>
<summary>Feet → Metres</summary>

<input id="ft">
<button onclick="ft()">Convert</button>

<div id="mResult" class="result"></div>

</details>

<details>
<summary>Gallons → Litres</summary>

<input id="gal">
<button onclick="gal()">Convert</button>

<div id="lResult" class="result"></div>

</details>

<details>
<summary>°F → °C</summary>

<input id="f">
<button onclick="temp()">Convert</button>

<div id="tempResult" class="result"></div>

</details>
<details>
<summary>Imperial per Acre Conversion</summary>

<label>Value</label>
<input id="acreVal">

<button onclick="acreConvert()">Convert</button>

<div id="acreResult" class="result"></div>

</details>

})

function ft(){mResult.innerText=(ft.value*0.3048).toFixed(2)}
function gal(){lResult.innerText=(gal.value*3.78541).toFixed(2)}
function temp(){tempResult.innerText=((f.value-32)*5/9).toFixed(2)}
function acreConvert(){acreResult.innerText=(acreVal.value/43560).toFixed(6)+" per ft²"}

