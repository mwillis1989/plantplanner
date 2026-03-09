document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock6")

block.innerHTML=`

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water L</label>
<input id="waterVol">

<label>Target ppm</label>
<input id="targetPPM">

<label>% peroxide</label>
<input id="peroxidePercent">

<button onclick="peroxide()">Calculate</button>

<div id="peroxideResult" class="result"></div>

</details>

`

})

function peroxide(){

peroxideResult.innerText=
((targetPPM.value*waterVol.value)/(peroxidePercent.value*10)).toFixed(2)+" ml"

}
