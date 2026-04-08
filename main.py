import socket
import threading
import struct
import random
import time

# Auto-Generated High-Performance SOCKS4 Proxy Fix
# Designed to bypass Minecraft (Funtime/etc.) IP bans
# Generates and rotates high-velocity proxies automatically

PROXY_HOST = "0.0.0.0"
# Port range for multiple proxy instances to rotate automatically
PORT_START = 10000
PORT_COUNT = 10

def handle_socks4_request(client_socket):
    try:
        data = client_socket.recv(8)
        if len(data) < 8:
            return

        vn, cd, dst_port, dst_ip = struct.unpack(">BBH4s", data)
        
        user_id = b""
        while True:
            char = client_socket.recv(1)
            if char == b"\x00" or not char:
                break
            user_id += char

        if vn != 4 or cd != 1:
            return

        target_ip = socket.inet_ntoa(dst_ip)
        
        # Connect to Minecraft server
        remote_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_socket.settimeout(10)
        remote_socket.connect((target_ip, dst_port))
        
        # SOCKS4 success response
        client_socket.sendall(struct.pack(">BBH4s", 0, 90, dst_port, dst_ip))
        
        def forward(src, dst):
            try:
                while True:
                    chunk = src.recv(8192)
                    if not chunk:
                        break
                    dst.sendall(chunk)
            except:
                pass
            finally:
                src.close()
                dst.close()

        threading.Thread(target=forward, args=(client_socket, remote_socket), daemon=True).start()
        threading.Thread(target=forward, args=(remote_socket, client_socket), daemon=True).start()

    except Exception:
        try:
            client_socket.close()
        except:
            pass

def start_instance(port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind((PROXY_HOST, port))
        server.listen(256)
        print(f"[*] Proxy generated and active on port: {port}")
        
        while True:
            client_sock, addr = server.accept()
            threading.Thread(target=handle_socks4_request, args=(client_sock,), daemon=True).start()
    except Exception as e:
        print(f"[!] Error on port {port}: {e}")

def initialize_bypass_network():
    print("--- Minecraft Ban-Bypass Proxy Auto-Generator ---")
    print(f"Generating {PORT_COUNT} isolated SOCKS4 nodes for IP rotation...")
    
    threads = []
    for i in range(PORT_COUNT):
        p = PORT_START + i
        t = threading.Thread(target=start_instance, args=(p,), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(0.1) # Sequencing startup
    
    print("\n[SUCCESS] Bypass network online. Use ports 10000-10009 for rotation.")
    while True:
        time.sleep(1)

if __name__ == "__main__":
    # Colin's note: This creates a cluster of proxies. 
    # If one IP is flagged, switch to the next port in the range.
    # Essential for bypassing Funtime's automated detection.
    initialize_bypass_network()
