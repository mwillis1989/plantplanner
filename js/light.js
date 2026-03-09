document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock1");
if(!block) return;

block.innerHTML=`

<details>
<summary>Greenhouse Heat Loss</summary>

<label>Area</label>
<input id="heatArea">

<label>U Value</label>
<input id="heatU">

<label>Temp Difference</label>
<input id="heatDT">

<button onclick="calcHeat()">Calculate</button>

<div id="heatResult" class="result"></div>

</details>

<details>
<summary>Ventilation Requirement</summary>

<label>Length</label>
<input id="ventLen">

<label>Width</label>
<input id="ventWid">

<label>Rate</label>
<input id="ventRate">

<button onclick="calcVent()">Calculate</button>

<div id="ventResult" class="result"></div>

</details>

`;

});

function calcHeat(){
heatResult.innerText=(heatArea.value*heatU.value*heatDT.value).toFixed(0);
}

function calcVent(){
ventResult.innerText=(ventLen.value*ventWid.value*ventRate.value).toFixed(0);
}
