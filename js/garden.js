document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock2")

block.innerHTML=`

<details>
<summary>Bed Dimension Increase</summary>

<label>Length</label>
<input id="bedL">

<label>Width</label>
<input id="bedW">

<label>Depth</label>
<input id="bedD">

<label>% Increase</label>
<input id="bedP">

<button onclick="bedCalc()">Calculate</button>

<div id="bedResult" class="result"></div>

</details>

<details>
<summary>Plant Count Calculator</summary>

<label>Area m²</label>
<input id="plantArea">

<label>Spacing cm</label>
<input id="plantSpace">

<button onclick="plantCalc()">Calculate</button>

<div id="plantResult" class="result"></div>

</details>

`

})

function bedCalc(){

const p=1+(bedP.value/100)

bedResult.innerText=
(bedL.value*p).toFixed(2)+" x "+
(bedW.value*p).toFixed(2)+" x "+
(bedD.value*p).toFixed(2)

}

function plantCalc(){

const space=(plantSpace.value/100)**2

plantResult.innerText=
Math.floor(plantArea.value/space)+" plants"

}
