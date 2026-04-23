package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientRequest struct {
	count     int
	lastSeen  time.Time
}

var (
	clients = make(map[string]*clientRequest)
	mu      sync.Mutex
)

// RateLimitLogin protege o endpoint de login contra ataques de força bruta.
// Permite no máximo 5 tentativas a cada 2 minutos por IP.
func RateLimitLogin() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		defer mu.Unlock()

		if client, ok := clients[ip]; ok {
			// Se passou mais de 2 minutos, reseta a contagem
			if now.Sub(client.lastSeen) > 2*time.Minute {
				client.count = 1
				client.lastSeen = now
			} else {
				client.count++
				client.lastSeen = now
				if client.count > 5 {
					c.Header("Content-Type", "application/json")
					c.JSON(http.StatusTooManyRequests, gin.H{
						"erro": "Muitas tentativas de login. Aguarde 2 minutos para tentar novamente.",
					})
					c.Abort()
					return
				}
			}
		} else {
			clients[ip] = &clientRequest{count: 1, lastSeen: now}
		}

		c.Next()
	}
}
