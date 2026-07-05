$files = Get-ChildItem "c:\Users\Hello\Documents\mat" -Recurse -Include *.html,*.js,*.css,*.sql,*.md -File
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $content = $content -creplace 'SuperMart\.', 'MathuraQuickMart.'
    $content = $content -creplace 'SuperMart =', 'MathuraQuickMart ='
    $content = $content -creplace 'SuperMart\(', 'MathuraQuickMart('
    $content = $content -creplace 'SuperMart:', 'MathuraQuickMart:'
    $content = $content -creplace 'SuperMart', 'Mathura Quick Mart'
    $content = $content -creplace 'supermart', 'mathuraquickmart'
    Set-Content -Path $f.FullName -Value $content -NoNewline
}
