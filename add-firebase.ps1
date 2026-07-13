$files = Get-ChildItem "c:\Users\Hello\Documents\mat" -Recurse -Filter *.html -File
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    
    if ($content -notmatch 'firebase-init.js') {
        $scriptTag = "
  <script type='module' src='/js/firebase-init.js'></script>
</head>"
        $content = $content -replace '</head>', $scriptTag
        Set-Content -Path $f.FullName -Value $content -NoNewline
    }
}
