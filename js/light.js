document.addEventListener("DOMContentLoaded", function () {

const block = document.getElementById("calcBlock5");
if (!block) return;

block.innerHTML = `

<details>
<summary>Lux → PPFD</summary>

<label>Lux</label>
<input id="lux">

<button onclick="luxPPFD()">Convert</button>

<div id="luxResult" class="result"></div>

</details>


<details>
<summary>Joules/cm² → DLI</summary>

<label>Joules/cm²</label>
<input id="joule">

<button onclick="jouleDLI()">Convert</button>

<div id="jouleResult" class="result"></div>

</details>


<details>
<summary>Micromoles → Moles</summary>

<label>µmol</label>
<input id="umol">

<button onclick="umolMol()">Convert</button>

<div id="molResult" class="result"></div>

</details>

`;

});


function luxPPFD() {
luxResult.innerText = (lux.value / 54).toFixed(2) + " µmol/m²/s";
}

function jouleDLI() {
jouleResult.innerText = (joule.value / 21.7).toFixed(2) + " mol/m²/day";
}

function umolMol() {
molResult.innerText = (umol.value / 1000000) + " mol";
}
