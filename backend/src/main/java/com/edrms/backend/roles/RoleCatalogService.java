package com.edrms.backend.roles;

import com.edrms.backend.auth.CurrentUserContext;
import com.edrms.backend.users.User;
import com.edrms.backend.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class RoleCatalogService {
    public static final Set<String> ACTIONS = Set.of("VIEW","UPLOAD","DOWNLOAD","DELETE","SHARE","PRINT","MANAGE_PERMISSIONS","AUDIT_READ");
    public static final Set<String> MENUS = Set.of("/documents","/search","/audit","/admin");
    private final RoleRepository roles;
    private final UserRepository users;
    private final CurrentUserContext context;
    private record CachedRole(Optional<Role> role,long expiresAt) {}
    private final Map<String,CachedRole> catalogCache = new java.util.concurrent.ConcurrentHashMap<>();
    public RoleCatalogService(RoleRepository roles, UserRepository users, CurrentUserContext context) {
        this.roles=roles; this.users=users; this.context=context;
    }
    public User requireUser() {
        User user=context.getCurrentUsername().flatMap(users::findByUsername)
            .orElseThrow(() -> new SecurityException("Sign in to continue"));
        if (!"ACTIVE".equals(user.getStatus()) || (user.getExpiresAt()!=null && user.getExpiresAt().isBefore(OffsetDateTime.now())))
            throw new SecurityException("Account is inactive or expired");
        return user;
    }
    public void requireManager() {
        User user=requireUser();
        if (!"SUPER_ADMIN".equals(user.getRole()) && !split(user.getPermissions()).contains("MANAGE_PERMISSIONS"))
            throw new SecurityException("Permission management access is required");
    }
    public Optional<Role> find(String name) {
        String key=name.toUpperCase(Locale.ROOT);
        CachedRole cached=catalogCache.get(key);
        if (cached!=null && cached.expiresAt()>System.currentTimeMillis()) return cached.role();
        Optional<Role> result=roles.findByName(key);
        catalogCache.put(key,new CachedRole(result,System.currentTimeMillis()+30000));
        return result;
    }
    public static List<String> split(String value) {
        return value==null || value.isBlank() ? List.of() : Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }
    public List<Map<String,Object>> list() {
        requireManager();
        return roles.findAll().stream().sorted(Comparator.comparing(Role::getName)).map(this::view).toList();
    }
    public Map<String,Object> view(Role role) {
        return Map.of("id",role.getId(),"name",role.getName(),"description",Objects.toString(role.getDescription(),""),
            "system",role.getIsSystem(),"permissions",split(role.getPermissionsCsv()),"menus",split(role.getMenusCsv()));
    }
    public record Request(String name,String description,List<String> permissions,List<String> menus) {}
    @Transactional
    public Map<String,Object> save(UUID id, Request request) {
        requireManager();
        String name=Objects.toString(request.name(),"").trim().toUpperCase(Locale.ROOT);
        if (!name.matches("[A-Z][A-Z0-9_]{1,49}")) throw new IllegalArgumentException("Use 2–50 letters, numbers or underscores for the role name");
        if (request.permissions()==null || !ACTIONS.containsAll(request.permissions()) || request.menus()==null || !MENUS.containsAll(request.menus()))
            throw new IllegalArgumentException("Select valid permissions and menus");
        if (request.description()!=null && request.description().length()>255) throw new IllegalArgumentException("Description is too long");
        Role role=id==null ? Role.builder().isSystem(false).build() : roles.findById(id).orElseThrow(() -> new IllegalArgumentException("Role not found"));
        if (Boolean.TRUE.equals(role.getIsSystem())) throw new SecurityException("Built-in roles are protected");
        Optional<Role> existing=roles.findByName(name);
        if (existing.isPresent() && !existing.get().getId().equals(id)) throw new IllegalArgumentException("Role name already exists");
        if (id!=null && !name.equals(role.getName())) throw new IllegalArgumentException("Role names cannot be changed after creation");
        role.setName(name); role.setDescription(request.description());
        role.setPermissionsCsv(String.join(",",new LinkedHashSet<>(request.permissions())));
        role.setMenusCsv(String.join(",",new LinkedHashSet<>(request.menus())));
        Role saved=roles.save(role); catalogCache.remove(name);
        return view(saved);
    }
}
