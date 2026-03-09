document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock5")

block.innerHTML=`

<details>
<summary>Greenhouse Heat Loss</summary>

<label>Area</label>
<input id="heatArea">

<label>U value</label>
<input id="heatU">

<label>Temp diff</label>
<input id="heatDT">

<button onclick="heat()">Calculate</button>

<div id="heatResult" class="result"></div>

</details>

`

})

function heat(){
heatResult.innerText=(heatArea.value*heatU.value*heatDT.value).toFixed(0)+" BTU/hr"
}
