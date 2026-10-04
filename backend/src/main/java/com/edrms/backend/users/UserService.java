package com.edrms.backend.users;

import com.edrms.backend.auth.CurrentUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final CurrentUserContext currentUserContext;

    public UserService(UserRepository userRepository, CurrentUserContext currentUserContext) {
        this.userRepository = userRepository;
        this.currentUserContext = currentUserContext;
    }

    public Optional<User> findById(UUID id) {
        return userRepository.findById(id);
    }

    public Optional<User> findByKeycloakId(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId);
    }

    @Transactional
    public User syncCurrentUser() {
        String keycloakId = currentUserContext.getCurrentUserKeycloakId()
            .orElse("00000000-0000-0000-0000-000000000001");
        String username = currentUserContext.getCurrentUsername().orElse("admin");
        String email = currentUserContext.getCurrentUserEmail().orElse(username + "@arkaa-digital.local");

        return userRepository.findByUsername(username)
            .or(() -> userRepository.findByKeycloakId(keycloakId))
            .map(existing -> {
                existing.setUsername(username);
                existing.setEmail(email);
                return userRepository.save(existing);
            })
            .orElseGet(() -> userRepository.save(User.builder()
                .keycloakId(keycloakId)
                .username(username)
                .email(email)
                .fullName("Administrator")
                .status("ACTIVE")
                .build()));
    }

    @Transactional
    public User syncUserByUsername(String username) {
        if (username == null || username.isBlank()) {
            return syncCurrentUser();
        }
        String raw = (username != null) ? username.trim() : "";
        if (raw.contains(",")) {
            raw = raw.split(",")[0].trim();
        }
        final String cleanUsername = raw.isEmpty() ? "admin" : raw;
        return userRepository.findByUsername(cleanUsername)
            .orElseGet(() -> userRepository.save(User.builder()
                .keycloakId(UUID.randomUUID().toString())
                .username(cleanUsername)
                .email(cleanUsername + "@arkaa-digital.local")
                .fullName(cleanUsername)
                .status("ACTIVE")
                .build()));
    }
}
