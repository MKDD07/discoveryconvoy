$file = 'c:\Users\mkmka\Desktop\Tourist\turie\index-6.html'
$content = [System.IO.File]::ReadAllText($file)

# Replace the static destination grid row (all 4 cards) with an empty dynamic row
$oldRow = '            <div class="row">
                <div class="col-xl-3 col-lg-6 col-md-6">
                   <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative mb-30 wow fadeInUp" data-wow-duration=".9s" data-wow-delay=".3s">
                      <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix">
                         <img class="w-100" src="assets/img/destination/eight/thumb.jpg" alt="">
                         <div class="tp-destination-one-content tp-destination-content">
                            <div class="tp-destination-one-left">
                               <h2 class="tp-destination-title common-underline mb-0"><a href="city-details-2.html">Shibuya crossing</a></h2>
                            </div>
                            <div class="tp-bounce">
                               <a href="city-details-2.html" class="tp-destination-two-btn">
                                  <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                     <path d="M11.4922 5.8927H0.900117" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                     <path d="M7.17626 10.8854C7.17626 10.8854 11.8838 7.20828 11.8838 5.89264C11.8838 4.57699 7.17618 0.900024 7.17618 0.900024" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                  </svg>
                                  <span></span>
                               </a>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div class="col-xl-3 col-lg-6 col-md-6">
                   <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative mb-30 wow fadeInUp" data-wow-duration=".9s" data-wow-delay=".4s">
                      <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix">
                         <img class="w-100" src="assets/img/destination/eight/thumb-2.jpg" alt="">
                         <div class="tp-destination-one-content tp-destination-content">
                            <div class="tp-destination-one-left">
                               <h2 class="tp-destination-title common-underline mb-0"><a href="city-details-2.html">Tokyo skytree</a></h2>
                            </div>
                            <div class="tp-bounce">
                               <a href="city-details-2.html" class="tp-destination-two-btn">
                                  <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                     <path d="M11.4922 5.8927H0.900117" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                     <path d="M7.17626 10.8854C7.17626 10.8854 11.8838 7.20828 11.8838 5.89264C11.8838 4.57699 7.17618 0.900024 7.17618 0.900024" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                  </svg>
                                  <span></span>
                               </a>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div class="col-xl-3 col-lg-6 col-md-6">
                   <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative mb-30 wow fadeInUp" data-wow-duration=".9s" data-wow-delay=".5s">
                      <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix">
                         <img class="w-100" src="assets/img/destination/eight/thumb-3.jpg" alt="">
                         <div class="tp-destination-one-content tp-destination-content">
                            <div class="tp-destination-one-left">
                               <h2 class="tp-destination-title common-underline mb-0"><a href="city-details-2.html">Akihabara</a></h2>
                            </div>
                            <div class="tp-bounce">
                               <a href="city-details-2.html" class="tp-destination-two-btn">
                                  <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                     <path d="M11.4922 5.8927H0.900117" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                     <path d="M7.17626 10.8854C7.17626 10.8854 11.8838 7.20828 11.8838 5.89264C11.8838 4.57699 7.17618 0.900024 7.17618 0.900024" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                  </svg>
                                  <span></span>
                               </a>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                <div class="col-xl-3 col-lg-6 col-md-6">
                   <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative mb-30 wow fadeInUp" data-wow-duration=".9s" data-wow-delay=".6s">
                      <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix">
                         <img class="w-100" src="assets/img/destination/eight/thumb-4.jpg" alt="">
                         <div class="tp-destination-one-content tp-destination-content">
                            <div class="tp-destination-one-left">
                               <h2 class="tp-destination-title common-underline mb-0"><a href="city-details-2.html">Osaka castle</a></h2>
                            </div>
                            <div class="tp-bounce">
                               <a href="city-details-2.html" class="tp-destination-two-btn">
                                  <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                     <path d="M11.4922 5.8927H0.900117" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                     <path d="M7.17626 10.8854C7.17626 10.8854 11.8838 7.20828 11.8838 5.89264C11.8838 4.57699 7.17618 0.900024 7.17618 0.900024" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                  </svg>
                                  <span></span>
                               </a>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>'

$newRow = '            <div class="row" id="tp-dest-grid">
               <!-- Dynamic destination cards injected by pexels.js -->
             </div>'

if ($content.Contains($oldRow)) {
    $content = $content.Replace($oldRow, $newRow)
    [System.IO.File]::WriteAllText($file, $content)
    Write-Host 'SUCCESS: Destination grid replaced with dynamic container.'
} else {
    Write-Host 'WARNING: Static row not found - checking line endings...'
    # Try with CRLF normalized
    $oldRowCRLF = $oldRow -replace "`n", "`r`n"
    if ($content.Contains($oldRowCRLF)) {
        $content = $content.Replace($oldRowCRLF, $newRow)
        [System.IO.File]::WriteAllText($file, $content)
        Write-Host 'SUCCESS (CRLF): Destination grid replaced.'
    } else {
        Write-Host 'FAILED: Could not find the static row. Adding id manually...'
        # Fallback: just add id to the first row after the header row
        $content = $content -replace '(<div class="row align-items-end mb-20">[\s\S]*?</div>\s*</div>\s*</div>\s*)\s*(<div class="row">)', '$1            <div class="row" id="tp-dest-grid">'
        Write-Host 'Tried regex fallback.'
    }
}
