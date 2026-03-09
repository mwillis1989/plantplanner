document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock6");
if(!block) return;

block.innerHTML=`

<details>
<summary>Hydrogen Peroxide Dilution</summary>

<label>Water Volume L</label>
<input id="vol">

<label>Target ppm</label>
<input id="ppm">

<label>Peroxide %</label>
<input id="strength">

<button onclick="peroxide()">Calculate</button>

<div id="peroxideResult" class="result"></div>

</details>

`;

});


function peroxide(){
peroxideResult.innerText=((ppm.value*vol.value)/(strength.value*10)).toFixed(2)+" mL";
}
