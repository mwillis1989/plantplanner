document.addEventListener("DOMContentLoaded",function(){

const block=document.getElementById("calcBlock5");
if(!block) return;

block.innerHTML=`

<details>
<summary>Lux → PPFD</summary>

<input id="lux">
<button onclick="luxPPFD()">Convert</button>

<div id="ppfdResult" class="result"></div>

</details>

<details>
<summary>Joules/cm² → DLI</summary>

<input id="joule">
<button onclick="jouleDLI()">Convert</button>

<div id="dliResult" class="result"></div>

</details>

<details>
<summary>Micromoles → Moles</summary>

<input id="umol">
<button onclick="umolMol()">Convert</button>

<div id="molResult" class="result"></div>

</details>

`;

});


function luxPPFD(){ppfdResult.innerText=(lux.value/54).toFixed(2)+" µmol/m²/s";}
function jouleDLI(){dliResult.innerText=(joule.value/21.7).toFixed(2)+" mol/m²/day";}
function umolMol(){molResult.innerText=(umol.value/1000000)+" mol";}
