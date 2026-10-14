use axum::Router;
use tower_http::services::ServeDir;
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use std::path::PathBuf;

pub async fn start_video_server(cache_dir: PathBuf) -> Result<u16, String> {
    let videos_dir = cache_dir.join("videos");
    let images_dir = cache_dir.join("images");

    // Create videos and images directories if they don't exist
    std::fs::create_dir_all(&videos_dir)
        .map_err(|e| format!("Failed to create videos directory: {}", e))?;
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;

    // Create CORS layer to allow the Tauri app to access the server
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Create the router with file serving for both videos and images
    let app = Router::new()
        .nest_service("/videos", ServeDir::new(&videos_dir))
        .nest_service("/images", ServeDir::new(&images_dir))
        .layer(cors);

    // Try to bind to a random available port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind to address: {}", e))?;

    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    println!("Video server starting on http://localhost:{}", port);

    // Spawn the server in the background
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("Video server error: {}", e);
        }
    });

    Ok(port)
}
