package com.edrms.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig implements WebMvcConfigurer {

    private final JwtAuthConverter jwtAuthConverter;

    public SecurityConfig(JwtAuthConverter jwtAuthConverter) {
        this.jwtAuthConverter = jwtAuthConverter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers.frameOptions(frame -> frame.disable()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/actuator/**",
                    "/api/v1/**",
                    "/api/**",
                    "/error"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter))
            );

        return http.build();
    }

    @Bean
    public org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder(
        JwtTokenService jwtTokenService,
        @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String issuerUri
    ) {
        return token -> {
            // 1. Check local HMAC JWT token first
            java.util.Optional<com.nimbusds.jwt.JWTClaimsSet> claimsOpt = jwtTokenService.validateToken(token);
            if (claimsOpt.isPresent()) {
                com.nimbusds.jwt.JWTClaimsSet claims = claimsOpt.get();
                java.util.Map<String, Object> claimsMap = new java.util.HashMap<>(claims.getClaims());
                if (claims.getClaim("role") != null) {
                    claimsMap.put("realm_access", java.util.Map.of("roles", java.util.List.of(claims.getClaim("role").toString())));
                }
                return new org.springframework.security.oauth2.jwt.Jwt(
                    token,
                    claims.getIssueTime() != null ? claims.getIssueTime().toInstant() : java.time.Instant.now(),
                    claims.getExpirationTime() != null ? claims.getExpirationTime().toInstant() : java.time.Instant.now().plusSeconds(3600),
                    java.util.Map.of("alg", "HS256"),
                    claimsMap
                );
            }

            // 2. Check Keycloak token if issuer is configured
            if (issuerUri != null && !issuerUri.isBlank()) {
                try {
                    org.springframework.security.oauth2.jwt.JwtDecoder keycloakDecoder =
                        org.springframework.security.oauth2.jwt.JwtDecoders.fromIssuerLocation(issuerUri);
                    return keycloakDecoder.decode(token);
                } catch (Exception ignored) {
                }
            }

            throw new org.springframework.security.oauth2.jwt.BadJwtException("Invalid or expired authentication token");
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD")
            .allowedHeaders("*")
            .exposedHeaders("*")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
