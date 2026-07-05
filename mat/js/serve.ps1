$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started on http://localhost:$port/"
$basePath = "c:\Users\Hello\Documents\mat"

# Run simple loop to process requests
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }
        
        # Replace forward slashes with platform-appropriate separators
        $cleanPath = $urlPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        # Ensure we don't have double separators
        if ($cleanPath.StartsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $cleanPath = $cleanPath.Substring(1)
        }
        
        $filePath = Join-Path $basePath $cleanPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Set basic MIME types
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "text/html"
            if ($ext -eq ".css") { $mime = "text/css" }
            elseif ($ext -eq ".js") { $mime = "application/javascript" }
            elseif ($ext -eq ".png") { $mime = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }
            elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            $buf = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: " + $filePath)
            $response.ContentLength64 = $buf.Length
            $response.OutputStream.Write($buf, 0, $buf.Length)
        }
        $response.Close()
    } catch {
        # Log error but don't crash
        Write-Warning "Request error: $_"
    }
}
