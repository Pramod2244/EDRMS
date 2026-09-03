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
            .orElseThrow(() -> new IllegalStateException("No authenticated user in context"));
        String username = currentUserContext.getCurrentUsername().orElse(keycloakId);
        String email = currentUserContext.getCurrentUserEmail().orElse(username + "@edrms.local");

        return userRepository.findByKeycloakId(keycloakId)
            .map(existing -> {
                existing.setUsername(username);
                existing.setEmail(email);
                return userRepository.save(existing);
            })
            .orElseGet(() -> userRepository.save(User.builder()
                .keycloakId(keycloakId)
                .username(username)
                .email(email)
                .fullName(username)
                .status("ACTIVE")
                .build()));
    }
}
