<?php
session_cache_limiter('customer');
session_start();

$user = "root";
$pass = "AdminDef";


if (isset($_SESSION['customer'])) {
    try {
        $id = $_POST['id'];
        $password = $_POST['password'];
        $name = $_POST['name'];

        $dbh = new PDO("mysql:host=localhost;dbname=2a_shinkyu", $user, $pass);

        // 更新処理。customerテーブルのid, password, nameを更新
        $sql = "UPDATE customer SET name = :name, password = :password WHERE id = :id";
        $stmt = $dbh->prepare($sql);
        $stmt->bindParam(':name', $name, PDO::PARAM_STR);
        $stmt->bindParam(':password', $password, PDO::PARAM_STR);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT); // idは整数型として扱う
        $stmt->execute();

        echo "<p>お客様情報を更新しました</p>";
    } catch (PDOException $e) {
        print "<p class='error'>エラー！：" . $e->getMessage() . "</p>";
        die();
    }
} else {
    try {
        $name = $_POST['name'];
        $id = $_POST['id']; // 新規登録時にもidを受け取る
        $password = $_POST['password'];

        $dbh = new PDO("mysql:host=localhost;dbname=2a_shinkyu", $user, $pass);

        // IDの重複チェック
        $checkSql = "SELECT * FROM customer WHERE id = :id";
        $checkStmt = $dbh->prepare($checkSql);
        $checkStmt->bindParam(':id', $id, PDO::PARAM_INT); // idは整数型として扱う
        $checkStmt->execute();

        $date = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!empty($date)) {
            // 同じIDが存在する場合
            echo "<p>同じIDがあります！変更してください。</p>";
        } else {
            // 同じIDが存在しない場合、登録処理
            $sql = "INSERT INTO customer (id, name, password) VALUES (:id, :name, :password)";
            $stmt = $dbh->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT); // idは整数型として扱う
            $stmt->bindParam(':name', $name, PDO::PARAM_STR);
            $stmt->bindParam(':password', $password, PDO::PARAM_STR);
            $stmt->execute();

            echo "<p>お客様情報を登録しました</p>";
        }
    } catch (PDOException $e) {
        print "<p class='error'>エラー！：" . $e->getMessage() . "</p>";
        die();
    }
}
