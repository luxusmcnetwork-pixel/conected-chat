class ChatApp {
    constructor() {
        this.websocket = null;
        this.usuario = null;
        this.estaConectado = false;
        this.usuarioRegistrado = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.mostrarModalBienvenida();
    }

    bindEvents() {
        // Botón unirse al chat
        document.getElementById('join-chat').addEventListener('click', () => this.unirseAlChat());
        
        // Enter en el input de nombre
        document.getElementById('username-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.unirseAlChat();
        });

        // Enviar mensaje
        document.getElementById('send-button').addEventListener('click', () => this.enviarMensaje());
        
        // Enter en el input de mensaje
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.enviarMensaje();
        });
    }

    mostrarModalBienvenida() {
        document.getElementById('welcome-modal').style.display = 'flex';
        document.getElementById('username-input').focus();
    }

    ocultarModalBienvenida() {
        document.getElementById('welcome-modal').style.display = 'none';
    }

    async unirseAlChat() {
        const nombreInput = document.getElementById('username-input');
        const nombre = nombreInput.value.trim();
        
        if (!nombre) {
            this.mostrarNotificacion('⚠️ Por favor, ingresa un nombre', 'warning');
            nombreInput.focus();
            return;
        }

        this.usuario = nombre;
        await this.conectarWebSocket();
    }

    async conectarWebSocket() {
        try {
            this.websocket = new WebSocket('ws://localhost:5000');
            
            this.websocket.onopen = () => {
                console.log('✅ Conectado al servidor WebSocket');
                this.estaConectado = true;
                this.actualizarEstadoConexion(true);
                
                // NO enviar el nombre inmediatamente, esperar la bienvenida del servidor
                this.ocultarModalBienvenida();
                document.querySelector('.chat-main').style.display = 'flex';
                document.getElementById('message-input').disabled = false;
                document.getElementById('send-button').disabled = false;
                
                this.mostrarNotificacion('🎉 ¡Conectado al chat!', 'success');
            };

            this.websocket.onmessage = (event) => {
                console.log('📨 Mensaje recibido:', event.data);
                this.procesarMensaje(JSON.parse(event.data));
            };

            this.websocket.onclose = () => {
                console.log('❌ Desconectado del servidor');
                this.estaConectado = false;
                this.usuarioRegistrado = false;
                this.actualizarEstadoConexion(false);
                this.mostrarNotificacion('🔌 Desconectado del chat', 'error');
                
                // Intentar reconectar después de 3 segundos
                setTimeout(() => {
                    if (!this.estaConectado) {
                        this.conectarWebSocket();
                    }
                }, 3000);
            };

            this.websocket.onerror = (error) => {
                console.error('❌ Error WebSocket:', error);
                this.mostrarNotificacion('❌ Error de conexión', 'error');
            };

        } catch (error) {
            console.error('Error conectando WebSocket:', error);
            this.mostrarNotificacion('❌ No se pudo conectar al servidor', 'error');
        }
    }

    procesarMensaje(datos) {
        console.log('📊 Procesando mensaje:', datos);
        
        switch (datos.tipo) {
            case 'bienvenida':
                this.mostrarMensajeSistema(datos);
                // Una vez recibida la bienvenida, enviar el nombre al servidor
                if (this.usuario && !this.usuarioRegistrado) {
                    this.websocket.send(JSON.stringify({
                        nombre: this.usuario
                    }));
                    this.usuarioRegistrado = true;
                    console.log('📤 Nombre enviado al servidor:', this.usuario);
                }
                break;
            case 'usuario_conectado':
                this.mostrarUsuarioConectado(datos);
                break;
            case 'usuario_desconectado':
                this.mostrarUsuarioDesconectado(datos);
                break;
            case 'mensaje_chat':
                this.mostrarMensajeChat(datos);
                break;
            case 'sistema':
                this.mostrarMensajeSistema(datos);
                break;
            case 'error':
                this.mostrarNotificacion(datos.mensaje, 'error');
                break;
            default:
                console.warn('❓ Tipo de mensaje desconocido:', datos.tipo);
        }
    }

    mostrarUsuarioConectado(datos) {
        this.actualizarContadorUsuarios(datos.usuarios_activos);
        
        const mensajeSistema = `
            <div class="system-message">
                <div class="message-content">
                    <span class="message-text">
                        🟢 <strong style="color: ${datos.color}">${datos.usuario}</strong> se unió al chat
                    </span>
                </div>
            </div>
        `;
        
        this.agregarAlChat(mensajeSistema);
        this.agregarUsuarioALista(datos.usuario, datos.color);
        this.mostrarNotificacion(`👋 ${datos.usuario} se unió al chat`, 'info');
        this.scrollToBottom();
    }

    mostrarUsuarioDesconectado(datos) {
        this.actualizarContadorUsuarios(datos.usuarios_activos);
        
        const mensajeSistema = `
            <div class="system-message">
                <div class="message-content">
                    <span class="message-text">
                        🔴 <strong style="color: ${datos.color}">${datos.usuario}</strong> salió del chat
                    </span>
                </div>
            </div>
        `;
        
        this.agregarAlChat(mensajeSistema);
        this.removerUsuarioDeLista(datos.usuario);
        this.scrollToBottom();
    }

    mostrarMensajeChat(datos) {
        const esPropio = datos.usuario === this.usuario;
        const tiempo = new Date(datos.timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const mensajeHTML = `
            <div class="message ${esPropio ? 'own-message' : ''}">
                <div class="message-avatar">${datos.avatar}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-username" style="color: ${esPropio ? 'white' : datos.color}">
                            ${datos.usuario}
                        </span>
                        <span class="message-time">${tiempo}</span>
                    </div>
                    <div class="message-text">${this.escapeHTML(datos.texto)}</div>
                </div>
            </div>
        `;
        
        this.agregarAlChat(mensajeHTML);
        this.scrollToBottom();
        console.log('💬 Mensaje mostrado:', datos.texto);
    }

    mostrarMensajeSistema(datos) {
        const mensajeHTML = `
            <div class="system-message">
                <div class="message-content">
                    <span class="message-text">${datos.mensaje}</span>
                </div>
            </div>
        `;
        
        this.agregarAlChat(mensajeHTML);
        this.scrollToBottom();
    }

    enviarMensaje() {
        if (!this.estaConectado || !this.websocket) {
            this.mostrarNotificacion('❌ No estás conectado al chat', 'error');
            return;
        }

        if (!this.usuarioRegistrado) {
            this.mostrarNotificacion('⏳ Esperando registro en el chat...', 'warning');
            return;
        }

        const input = document.getElementById('message-input');
        const texto = input.value.trim();

        if (!texto) return;

        console.log('📤 Enviando mensaje:', texto);

        // Enviar mensaje al servidor
        this.websocket.send(JSON.stringify({
            tipo: 'mensaje',
            texto: texto
        }));

        // Limpiar input
        input.value = '';
        input.focus();
    }

    agregarAlChat(html) {
        const container = document.getElementById('messages-container');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        container.appendChild(tempDiv.firstElementChild);
    }

    agregarUsuarioALista(nombre, color) {
        const usersList = document.getElementById('users-list');
        
        // Evitar duplicados
        if (document.querySelector(`[data-user="${nombre}"]`)) {
            return;
        }
        
        const userHTML = `
            <div class="user-item" data-user="${nombre}">
                <span class="user-avatar">👤</span>
                <span class="user-name" style="color: ${color}">${nombre}</span>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = userHTML;
        usersList.appendChild(tempDiv.firstElementChild);
    }

    removerUsuarioDeLista(nombre) {
        const userElement = document.querySelector(`[data-user="${nombre}"]`);
        if (userElement) {
            userElement.remove();
        }
    }

    actualizarContadorUsuarios(cantidad) {
        document.getElementById('user-count').textContent = 
            `${cantidad} usuario${cantidad !== 1 ? 's' : ''}`;
    }

    actualizarEstadoConexion(conectado) {
        const statusElement = document.getElementById('status');
        if (conectado) {
            statusElement.textContent = '🟢 Conectado';
            statusElement.className = 'status-online';
        } else {
            statusElement.textContent = '🔴 Desconectado';
            statusElement.className = 'status-offline';
        }
    }

    mostrarNotificacion(mensaje, tipo = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification notification-${tipo}`;
        notification.textContent = mensaje;
        
        notifications.appendChild(notification);
        
        // Auto-eliminar después de 4 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    scrollToBottom() {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }

    escapeHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});