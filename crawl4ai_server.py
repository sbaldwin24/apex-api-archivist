#!/usr/bin/env python3
"""
Minimal Crawl4AI Server with Enhanced Bot Evasion + Proxy Rotation
"""
import asyncio
from crawl4ai import AsyncWebCrawler
from aiohttp import web, web_request
import json
import random
import os

# Rotate through different user agents
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

async def crawl_handler(request: web_request.Request):
    """Handle crawl requests"""
    try:
        data = await request.json()
        urls = data.get('urls', [])
        browser_config = data.get('browser_config', {})
        
        if isinstance(urls, str):
            urls = [urls]
        
        if not urls:
            return web.json_response({'error': 'No URLs provided'}, status=400)
        
        results = []
        
        for url in urls:
            print(f"Crawling: {url}")
            
            # Use provided user agent or random one
            user_agent = browser_config.get('user_agent', random.choice(USER_AGENTS))
            
            # Get headless setting from browser config
            headless = browser_config.get('headless', True)
            
            # Build extra args
            extra_args = browser_config.get('extra_args', [
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--no-first-run",
                "--disable-extensions"
            ])
            
            # Handle proxy configuration
            proxy_config = browser_config.get('proxy')
            if proxy_config:
                proxy_server = proxy_config.get('server')
                proxy_username = proxy_config.get('username')
                proxy_password = proxy_config.get('password')
                
                if proxy_server:
                    if proxy_username and proxy_password:
                        # Format: http://username:password@server
                        if '://' in proxy_server:
                            protocol, server = proxy_server.split('://', 1)
                            proxy_url = f"{protocol}://{proxy_username}:{proxy_password}@{server}"
                        else:
                            proxy_url = f"http://{proxy_username}:{proxy_password}@{proxy_server}"
                    else:
                        proxy_url = proxy_server
                    
                    extra_args.append(f"--proxy-server={proxy_url}")
                    print(f"Using proxy: {proxy_server}")
            
            async with AsyncWebCrawler(
                verbose=True,
                headless=headless,
                browser_type="chromium",
                user_agent=user_agent,
                extra_args=extra_args
            ) as crawler:
                await asyncio.sleep(random.randint(2, 5))  # Random delay
                
                result = await crawler.arun(
                    url=url,
                    wait_for="body",
                    delay_before_return_html=random.randint(2, 5),
                    js_code=[
                        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})",
                        "delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array",
                        "delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise",
                        "delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol"
                    ],
                    page_timeout=30000
                )
                
                print(f"Success: {result.success}, Status: {getattr(result, 'status_code', 'unknown')}")
                
                results.append({
                    'success': result.success,
                    'html': result.html,
                    'url': url,
                    'status_code': getattr(result, 'status_code', 200),
                    'error': getattr(result, 'error_message', None) if not result.success else None
                })
        
        return web.json_response(results)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return web.json_response({'error': str(e)}, status=500)

async def health_handler(request: web_request.Request):
    """Health check endpoint"""
    return web.json_response({
        'status': 'healthy',
        'user_agents': len(USER_AGENTS)
    })

def create_app():
    """Create the web application"""
    app = web.Application()
    app.router.add_post('/crawl', crawl_handler)
    app.router.add_get('/health', health_handler)
    return app

if __name__ == '__main__':
    app = create_app()
    web.run_app(app, host='localhost', port=11235)
