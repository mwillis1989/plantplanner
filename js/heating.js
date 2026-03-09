document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock4");
if(!block) return;

block.innerHTML=`

<details>
<summary>Greenhouse Heat Loss</summary>

<label>Area ft²</label>
<input id="area">

<label>U value</label>
<input id="u">

<label>Temp Difference</label>
<input id="dt">

<button onclick="heatLoss()">Calculate</button>

<div id="heatResult" class="result"></div>

</details>


<details>
<summary>Ventilation Requirement</summary>

<label>Length</label>
<input id="len">

<label>Width</label>
<input id="wid">

<label>Rate</label>
<input id="rate">

<button onclick="ventCalc()">Calculate</button>

<div id="ventResult" class="result"></div>

</details>

`;

});


function heatLoss(){
heatResult.innerText=(area.value*u.value*dt.value).toFixed(0)+" BTU/hr";
}

function ventCalc(){
ventResult.innerText=(len.value*wid.value*rate.value).toFixed(0)+" CFM";
}
