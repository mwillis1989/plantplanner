function loadCalculator(file, block){

fetch(file)
.then(r=>r.text())
.then(html=>{
document.getElementById(block).innerHTML=html
})

}

document.addEventListener("DOMContentLoaded",function(){

loadCalculator("calculators/climate.html","calcBlock1")
loadCalculator("calculators/fertilizer.html","calcBlock2")
loadCalculator("calculators/conversions.html","calcBlock3")
loadCalculator("calculators/heating.html","calcBlock4")
loadCalculator("calculators/light.html","calcBlock5")
loadCalculator("calculators/water.html","calcBlock6")

})
